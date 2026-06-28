import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

seed_code = """API_KEYS_FILE = ".env.keys"

# Seed default keys if missing
if not os.path.exists(API_KEYS_FILE) or os.path.getsize(API_KEYS_FILE) < 10:
    with open(API_KEYS_FILE, "w") as f:
        f.write("ALPACA_KEY=PKS3UEZSKP65JV6BKPJLWSIS75\\n")
        f.write("ALPACA_SECRET=oY4vQX8SEaLE6JJM9FpD7mMNZ1kknwGmQDMrhow8qjk\\n")
        f.write("BINANCE_KEY=7SZAMU47R3dIffolzEpVGNfofSHKkgjvXiiEhMzwUN5rPy1sv6WBt5nrIFKQbFDw\\n")
        f.write("BINANCE_SECRET=vjeCiMl7MnJ7NhG46iAMzmPXjJ0EMbqQ65D6GH54wMjBydpCAzZ0Tvm1xlc3rZPV\\n")
        f.write("THEODDS_KEY=7aaa30fc512aa2fbf0e180d1431f1f73\\n")
        f.write("KRAKEN_KEY=\\n")
        f.write("KRAKEN_SECRET=\\n")
        f.write("ELEVENLABS_KEY=\\n")
"""

content = content.replace('API_KEYS_FILE = ".env.keys"', seed_code)

with open(file_path, 'w') as f:
    f.write(content)
print("api.py seeded with default keys.")
