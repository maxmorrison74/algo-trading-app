from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import os
import hmac
import hashlib
import models, database
from routers_auth import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])

LEMON_SQUEEZY_WEBHOOK_SECRET = os.getenv("LEMON_SQUEEZY_WEBHOOK_SECRET", "test_secret")

@router.post("/webhook")
async def lemonsqueezy_webhook(request: Request, x_signature: str = Header(None)):
    if not x_signature or not LEMON_SQUEEZY_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing signature or secret")
        
    payload = await request.body()
    
    # Verify Lemon Squeezy signature
    digest = hmac.new(
        LEMON_SQUEEZY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(digest, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    import json
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_name = event.get('meta', {}).get('event_name')
    data = event.get('data', {}).get('attributes', {})
    
    # In Lemon Squeezy, we pass the user ID in custom_data
    custom_data = event.get('meta', {}).get('custom_data', {})
    user_id = custom_data.get('user_id')
    
    db = next(database.get_db())
    
    if event_name == 'subscription_created':
        customer_id = data.get('customer_id')
        if user_id:
            user = db.query(models.User).filter(models.User.id == int(user_id)).first()
            if user:
                user.stripe_customer_id = str(customer_id) # Usiamo lo stesso campo db anche per Lemon
                user.subscription_active = True
                db.commit()
                print(f"✅ [LemonSqueezy] Subscription activated for user {user.email}")

    elif event_name in ['subscription_cancelled', 'subscription_expired']:
        customer_id = data.get('customer_id')
        user = db.query(models.User).filter(models.User.stripe_customer_id == str(customer_id)).first()
        if user:
            user.subscription_active = False
            db.commit()
            print(f"❌ [LemonSqueezy] Subscription cancelled for user {user.email}")

    return {"status": "success"}
