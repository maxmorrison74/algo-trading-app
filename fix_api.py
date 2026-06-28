with open("backend/api.py", "r") as f:
    content = f.read()

content = content.replace('        if mod_id == "trading":\n            if active and not alpaca_engine.running:\n                threading.Thread(target=alpaca_engine.loop, daemon=True).start()\n', '')

with open("backend/api.py", "w") as f:
    f.write(content)
