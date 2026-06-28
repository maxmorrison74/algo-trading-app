import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

old_save = """@app.post("/api/keys")
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
    return {"message": "Keys saved successfully"}"""

new_save = """@app.post("/api/keys")
def save_keys(req: KeysRequest):
    # Read existing
    existing = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    existing[k] = v

    # Merge logic: if incoming is empty or '***' (masked), keep existing
    def merge(key_name, incoming_val):
        if not incoming_val or "***" in incoming_val:
            return existing.get(key_name, "")
        return incoming_val

    new_alpaca_key = merge("ALPACA_KEY", req.alpaca_key)
    new_alpaca_secret = merge("ALPACA_SECRET", req.alpaca_secret)
    new_binance_key = merge("BINANCE_KEY", req.binance_key)
    new_binance_secret = merge("BINANCE_SECRET", req.binance_secret)
    new_kraken_key = merge("KRAKEN_KEY", req.kraken_key)
    new_kraken_secret = merge("KRAKEN_SECRET", req.kraken_secret)
    new_elevenlabs_key = merge("ELEVENLABS_KEY", req.elevenlabs_key)
    new_theodds_key = merge("THEODDS_KEY", req.theodds_key)

    with open(API_KEYS_FILE, "w") as f:
        f.write(f"ALPACA_KEY={new_alpaca_key}\\n")
        f.write(f"ALPACA_SECRET={new_alpaca_secret}\\n")
        f.write(f"BINANCE_KEY={new_binance_key}\\n")
        f.write(f"BINANCE_SECRET={new_binance_secret}\\n")
        f.write(f"KRAKEN_KEY={new_kraken_key}\\n")
        f.write(f"KRAKEN_SECRET={new_kraken_secret}\\n")
        f.write(f"ELEVENLABS_KEY={new_elevenlabs_key}\\n")
        f.write(f"THEODDS_KEY={new_theodds_key}\\n")
        
    return {"message": "Keys saved successfully"}"""

content = content.replace(old_save, new_save)

with open(file_path, 'w') as f:
    f.write(content)
print("api.py save_keys logic patched for merging.")
