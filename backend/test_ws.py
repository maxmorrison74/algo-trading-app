import time
import threading
from crypto_arbitrage import CryptoArbitrage

class DummyBotState:
    def __init__(self):
        self.modules = {"crypto_arb": True}
        self.virtual_cash = 10000.0

state = DummyBotState()
arb = CryptoArbitrage(state)

print("Starting WebSocket engine in background thread...")
t = threading.Thread(target=arb.loop, daemon=True)
t.start()

time.sleep(15)
print("Stopping engine...")
state.modules["crypto_arb"] = False
time.sleep(2)

print("\n--- LOGS ---")
for log in reversed(state.arb_logs):
    print(log)
