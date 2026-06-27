import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

# 1. Import
if "from ai_content import AIContentCreator" not in content:
    content = content.replace("from sports_arbitrage import SportsArbitrage\n", "from sports_arbitrage import SportsArbitrage\nfrom ai_content import AIContentCreator\n")

# 2. Instantiate
if "ai_engine = AIContentCreator(bot_state)" not in content:
    content = content.replace("sports_engine = SportsArbitrage(bot_state)", "sports_engine = SportsArbitrage(bot_state)\nai_engine = AIContentCreator(bot_state)")

# 3. Toggle logic
ai_toggle = """
        if mod_id == "ai_content":
            if active and not ai_engine.running:
                threading.Thread(target=ai_engine.loop, daemon=True).start()
"""
if 'if mod_id == "ai_content":' not in content:
    content = content.replace('if mod_id == "sports_arb":', ai_toggle + '        if mod_id == "sports_arb":')

# 4. Status return
if '"ai_logs"' not in content:
    content = content.replace('"active_surebets": getattr(bot_state, "active_surebets", [])', '"active_surebets": getattr(bot_state, "active_surebets", []),\n            "ai_logs": getattr(bot_state, "ai_logs", []),\n            "ai_videos": getattr(bot_state, "ai_videos", [])')

with open(api_path, 'w') as f:
    f.write(content)

print("AI Content Creator wired to API.")
