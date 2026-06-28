import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

old_req = """class TestConnectionRequest(BaseModel):
    service: str"""

new_req = """class TestConnectionRequest(BaseModel):
    service: str
    alpaca_key: str = ""
    alpaca_secret: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""
"""
content = content.replace(old_req, new_req)

old_logic = """    if not os.path.exists(API_KEYS_FILE):
         return {"status": "error", "message": "Nessuna chiave configurata."}
         
    # Read current keys
    keys = {}
    with open(API_KEYS_FILE, "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                keys[k] = v"""

new_logic = """    keys = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    keys[k] = v
                    
    # Overlay with keys from request if present
    if req.alpaca_key: keys['ALPACA_KEY'] = req.alpaca_key
    if req.alpaca_secret: keys['ALPACA_SECRET'] = req.alpaca_secret
    if req.binance_key: keys['BINANCE_KEY'] = req.binance_key
    if req.binance_secret: keys['BINANCE_SECRET'] = req.binance_secret
    if req.kraken_key: keys['KRAKEN_KEY'] = req.kraken_key
    if req.kraken_secret: keys['KRAKEN_SECRET'] = req.kraken_secret
    if req.elevenlabs_key: keys['ELEVENLABS_KEY'] = req.elevenlabs_key
    if req.theodds_key: keys['THEODDS_KEY'] = req.theodds_key
    """
content = content.replace(old_logic, new_logic)

with open(file_path, 'w') as f:
    f.write(content)

print("api.py test_connection patched")
