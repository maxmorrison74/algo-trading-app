import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

# 1. Update load_db default
content = content.replace(
    'return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0}',
    'return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0, "modules": {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False}}'
)

# 2. Update BotState init
init_line = '        self.aggressiveness = db_data.get("aggressiveness", 55.0)'
new_init = init_line + '\n        self.modules = db_data.get("modules", {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False})'
content = content.replace(init_line, new_init)

# 3. Update save_db
save_line = '            "trade_history": self.trade_history,\n        })'
new_save = '            "trade_history": self.trade_history,\n            "modules": self.modules\n        })'
content = content.replace(save_line, new_save)

# 4. Update get_status
status_line = '            "win_rate": win_rate\n        }'
new_status = '            "win_rate": win_rate,\n            "modules": bot_state.modules\n        }'
content = content.replace(status_line, new_status)

# 5. Add /api/modules endpoint
modules_api = """
@app.post("/api/modules")
async def toggle_module(payload: dict):
    mod_id = payload.get("module")
    active = payload.get("active")
    if mod_id in bot_state.modules:
        bot_state.modules[mod_id] = active
        bot_state.save_state()
        state_str = "ATTIVATO" if active else "DISATTIVATO"
        bot_state.add_log(f"⚙️ Modulo {mod_id.upper()} {state_str}")
        
        # Start/Stop logic if needed
        if mod_id == "trading":
            if active and not bot_state.is_running:
                bot_state.is_running = True
                threading.Thread(target=trading_loop, daemon=True).start()
            elif not active:
                bot_state.is_running = False
                
        return {"message": "Modulo aggiornato", "modules": bot_state.modules}
    return {"error": "Modulo non trovato"}
"""

if "@app.post(\"/api/modules\")" not in content:
    content = content.replace("@app.post(\"/api/start\")", modules_api + "\n@app.post(\"/api/start\")")

with open(api_path, 'w') as f:
    f.write(content)

print("Omni API patch applied.")
