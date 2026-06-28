import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

old_db = """DB_FILE = "bot_db.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0, "modules": {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False}}

def save_db(state_dict):
    with open(DB_FILE, "w") as f:
        json.dump(state_dict, f)"""

new_db = """DB_FILE = "bot_db.json"
import threading
db_lock = threading.Lock()

def load_db():
    with db_lock:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, "r") as f:
                return json.load(f)
        return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0, "modules": {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False}}

def save_db(state_dict):
    with db_lock:
        with open(DB_FILE, "w") as f:
            json.dump(state_dict, f)"""

content = content.replace(old_db, new_db)

with open(file_path, 'w') as f:
    f.write(content)
print("api.py DB lock patched")
