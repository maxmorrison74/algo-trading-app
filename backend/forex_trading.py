import os
from oandapyV20 import API
import oandapyV20.endpoints.pricing as pricing
import oandapyV20.endpoints.orders as orders

def get_oanda_client(api_key, account_id):
    """Restituisce il client OANDA"""
    # Di default usa 'practice' per demo
    return API(access_token=api_key, environment="practice")

def get_forex_pricing(api_key, account_id, instruments="EUR_USD,GBP_USD"):
    """Recupera il prezzo in tempo reale per strumenti Forex"""
    client = get_oanda_client(api_key, account_id)
    try:
        params = {"instruments": instruments}
        r = pricing.PricingInfo(accountID=account_id, params=params)
        client.request(r)
        
        prices = {}
        for p in r.response.get("prices", []):
            prices[p['instrument']] = {
                "bid": float(p['bids'][0]['price']),
                "ask": float(p['asks'][0]['price'])
            }
        return {"status": "success", "prices": prices}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def execute_forex_trade(api_key, account_id, instrument: str, units: int):
    """Esegue un trade sul Forex. units positivi per LONG, negativi per SHORT"""
    client = get_oanda_client(api_key, account_id)
    try:
        data = {
            "order": {
                "units": str(units),
                "instrument": instrument,
                "timeInForce": "FOK",
                "type": "MARKET",
                "positionFill": "DEFAULT"
            }
        }
        r = orders.OrderCreate(accountID=account_id, data=data)
        client.request(r)
        return {"status": "success", "order": r.response}
    except Exception as e:
        return {"status": "error", "message": str(e)}
