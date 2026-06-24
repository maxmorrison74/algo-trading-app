import os
import alpaca_trade_api as tradeapi

API_KEY = os.getenv("ALPACA_API_KEY")
API_SECRET = os.getenv("ALPACA_SECRET_KEY")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

try:
    alpaca = tradeapi.REST(API_KEY, API_SECRET, BASE_URL, api_version='v2')
    positions = alpaca.list_positions()
    mrna_pos = next((p for p in positions if p.symbol == "MRNA"), None)
    if mrna_pos:
        print(f"Chiusura posizione MRNA: {mrna_pos.qty}")
        alpaca.submit_order(symbol="MRNA", qty=mrna_pos.qty, side='sell', type='market', time_in_force='day')
        print("Ordine inserito.")
    else:
        print("Nessuna posizione MRNA.")
except Exception as e:
    print(f"Errore: {e}")
