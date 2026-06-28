import requests
import json
import time

base_url = "http://127.0.0.1:8000"

# 1. Test Status
print("1. Querying initial status...")
res = requests.get(f"{base_url}/api/status")
print("Status Code:", res.status_code)
initial_state = res.json()
print("Trading Module initially:", initial_state.get("modules", {}).get("trading"))

# 2. Toggle trading to True
print("\n2. Toggling trading module to True...")
res = requests.post(f"{base_url}/api/modules", json={"module": "trading", "active": True})
print("Toggle Status Code:", res.status_code)
print("Toggle Response:", res.json())

# 3. Query status again immediately
print("\n3. Querying status immediately...")
res = requests.get(f"{base_url}/api/status")
print("Status Code:", res.status_code)
state_after = res.json()
print("Trading Module after toggle:", state_after.get("modules", {}).get("trading"))

# 4. Wait 3 seconds and query status again
print("\n4. Waiting 3 seconds and querying status...")
time.sleep(3)
res = requests.get(f"{base_url}/api/status")
print("Status Code:", res.status_code)
state_later = res.json()
print("Trading Module later:", state_later.get("modules", {}).get("trading"))
