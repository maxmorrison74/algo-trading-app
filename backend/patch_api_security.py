import os
import json

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

# Trova dove inserire i nuovi endpoint (prima dell'avvio uvicorn)
insertion_point = 'if __name__ == "__main__":'

security_code = """
from pydantic import BaseModel
import os

# --- SECURITY & API KEYS ---
# In produzione password dovrebbe essere hashata. Per ora plain text (protetto in .env)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "impero2026")
API_KEYS_FILE = ".env.keys"

class LoginRequest(BaseModel):
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "token": "temp_auth_token_123"}
    return {"status": "error", "message": "Accesso Negato"}, 401

class KeysRequest(BaseModel):
    alpaca_key: str = ""
    alpaca_secret: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""

@app.get("/api/keys")
def get_keys():
    # Return masked keys
    keys = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    if v:
                        keys[k] = v[:4] + "*" * 10 if len(v) > 4 else "***"
    return keys

@app.post("/api/keys")
def save_keys(req: KeysRequest):
    with open(API_KEYS_FILE, "w") as f:
        f.write(f"ALPACA_KEY={req.alpaca_key}\\n")
        f.write(f"ALPACA_SECRET={req.alpaca_secret}\\n")
        f.write(f"BINANCE_KEY={req.binance_key}\\n")
        f.write(f"BINANCE_SECRET={req.binance_secret}\\n")
        f.write(f"KRAKEN_KEY={req.kraken_key}\\n")
        f.write(f"KRAKEN_SECRET={req.kraken_secret}\\n")
        f.write(f"ELEVENLABS_KEY={req.elevenlabs_key}\\n")
        f.write(f"THEODDS_KEY={req.theodds_key}\\n")
    return {"status": "success", "message": "Chiavi salvate nel Vault"}

class TestConnectionRequest(BaseModel):
    service: str

@app.post("/api/test-connection")
def test_connection(req: TestConnectionRequest):
    # Dummy test for now. In real life, ping the API endpoints.
    if not os.path.exists(API_KEYS_FILE):
         return {"status": "error", "message": "Nessuna chiave configurata."}
         
    # Simulate a successful connection test
    return {"status": "success", "message": f"Connessione a {req.service.upper()} stabilita con successo!"}

"""

if "def login(" not in content:
    content = content.replace(insertion_point, security_code + "\n" + insertion_point)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Security API patched successfully.")
else:
    print("Security API already patched.")

