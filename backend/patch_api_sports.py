import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

# 1. Import
if "from sports_arbitrage import SportsArbitrage" not in content:
    content = content.replace("from crypto_arbitrage import CryptoArbitrage\n", "from crypto_arbitrage import CryptoArbitrage\nfrom sports_arbitrage import SportsArbitrage\n")

# 2. Instantiate
if "sports_engine = SportsArbitrage(bot_state)" not in content:
    content = content.replace("arb_engine = CryptoArbitrage(bot_state)", "arb_engine = CryptoArbitrage(bot_state)\nsports_engine = SportsArbitrage(bot_state)")

# 3. Toggle logic
sports_toggle = """
        if mod_id == "sports_arb":
            if active and not sports_engine.running:
                threading.Thread(target=sports_engine.loop, daemon=True).start()
"""
if 'if mod_id == "sports_arb":' not in content:
    content = content.replace('if mod_id == "crypto_arb":', sports_toggle + '        if mod_id == "crypto_arb":')

# 4. Status return
if '"sports_logs"' not in content:
    content = content.replace('"arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0})', '"arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),\n            "sports_logs": getattr(bot_state, "sports_logs", []),\n            "active_surebets": getattr(bot_state, "active_surebets", [])')

with open(api_path, 'w') as f:
    f.write(content)

print("Sports Arbitrage wired to API.")
