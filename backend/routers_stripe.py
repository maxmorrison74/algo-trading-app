from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import stripe
import os
import models, database
from routers_auth import get_current_user

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# L'abbonamento mensile ID in Stripe
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "price_xxxxx") 
DOMAIN = os.getenv("DOMAIN", "http://localhost:5173")

@router.post("/create-checkout-session")
def create_checkout_session(user: models.User = Depends(get_current_user)):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
        
    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=user.email,
            payment_method_types=['card'],
            line_items=[
                {
                    'price': STRIPE_PRICE_ID,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=DOMAIN + '/dashboard?success=true',
            cancel_url=DOMAIN + '/dashboard?canceled=true',
            client_reference_id=str(user.id)
        )
        return {"checkoutUrl": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    if not stripe_signature or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Invalid Stripe configuration or signature")
        
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    db = next(database.get_db())
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get("client_reference_id")
        customer_id = session.get("customer")
        
        if user_id:
            user = db.query(models.User).filter(models.User.id == int(user_id)).first()
            if user:
                user.stripe_customer_id = customer_id
                user.subscription_active = True
                db.commit()
                print(f"✅ Subscription activated for user {user.email}")

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get("customer")
        user = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if user:
            user.subscription_active = False
            db.commit()
            print(f"❌ Subscription deleted for user {user.email}")

    return {"status": "success"}
