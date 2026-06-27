import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

# 1. Import
if "from crypto_arbitrage import CryptoArbitrage" not in content:
    content = content.replace("import threading\n", "import threading\nfrom crypto_arbitrage import CryptoArbitrage\n")

# 2. Instantiate
if "arb_engine = CryptoArbitrage(bot_state)" not in content:
    content = content.replace("bot_state = BotState()", "bot_state = BotState()\narb_engine = CryptoArbitrage(bot_state)")

# 3. Toggle logic
arb_toggle = """
        if mod_id == "crypto_arb":
            if active and not arb_engine.running:
                threading.Thread(target=arb_engine.loop, daemon=True).start()
"""
if 'if mod_id == "crypto_arb":' not in content:
    content = content.replace('if mod_id == "trading":', arb_toggle + '        if mod_id == "trading":')

# 4. Status return
if '"arb_logs"' not in content:
    content = content.replace('"modules": bot_state.modules', '"modules": bot_state.modules,\n            "arb_logs": getattr(bot_state, "arb_logs", []),\n            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0})')

with open(api_path, 'w') as f:
    f.write(content)

print("Arbitrage wired to API.")
