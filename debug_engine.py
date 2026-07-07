import json
try:
    with open("backend/bot_db.json") as f:
        print("bot_db:", json.load(f).get("high_risk_arb_logs", [])[:5])
except Exception as e:
    print(e)
import glob
for f in glob.glob("logs/*"):
    print("---", f)
    try:
        with open(f) as fd:
            print(fd.read()[-500:])
    except Exception as e:
        print(e)
