import asyncio
from backend.crypto_arbitrage import CryptoArbitrage

class DummyState:
    def __init__(self):
        self.modules = {"high_risk_crypto_arb": True, "crypto_arb": True}
        self.arb_logs = []
        self.high_risk_arb_logs = []

async def main():
    state = DummyState()
    arb = CryptoArbitrage(state)
    arb.user_id = "test"
    arb.running = True
    print("Starting loop...")
    
    try:
        await arb._arb_loop()
    except Exception as e:
        print(f"Exception: {repr(e)}")
    print("Done.")

asyncio.run(main())
