import os
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetOptionContractsRequest
from alpaca.trading.enums import AssetClass, OrderSide, TimeInForce

def get_alpaca_options_client(api_key, api_secret, base_url):
    """Restituisce il client Alpaca per le Opzioni"""
    paper = "paper" in base_url.lower()
    return TradingClient(api_key, api_secret, paper=paper)

def get_option_chain(api_key, api_secret, base_url, underlying_symbol: str, limit: int = 10):
    """Recupera la Option Chain per un determinato simbolo"""
    client = get_alpaca_options_client(api_key, api_secret, base_url)
    try:
        req = GetOptionContractsRequest(
            underlying_symbols=[underlying_symbol],
            limit=limit,
            status="active"
        )
        contracts = client.get_option_contracts(req)
        
        chain = []
        for c in contracts.option_contracts:
            chain.append({
                "symbol": c.symbol,
                "name": c.name,
                "type": c.type,  # call / put
                "strike_price": float(c.strike_price),
                "expiration_date": str(c.expiration_date),
                "close_price": float(c.close_price) if c.close_price else 0.0
            })
        return {"status": "success", "chain": chain}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def execute_option_trade(api_key, api_secret, base_url, option_symbol: str, qty: int, side: str):
    """Esegue un ordine su un contratto di opzioni"""
    client = get_alpaca_options_client(api_key, api_secret, base_url)
    try:
        from alpaca.trading.requests import MarketOrderRequest
        req = MarketOrderRequest(
            symbol=option_symbol,
            qty=qty,
            side=OrderSide.BUY if side.lower() == 'buy' else OrderSide.SELL,
            time_in_force=TimeInForce.DAY
        )
        order = client.submit_order(req)
        return {"status": "success", "order_id": str(order.id), "symbol": order.symbol}
    except Exception as e:
        return {"status": "error", "message": str(e)}
