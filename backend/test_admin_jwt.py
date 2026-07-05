import os
import sys
from fastapi.testclient import TestClient

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["ADMIN_PASSWORD_HASH"] = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" # 123
os.environ["JWT_SECRET"] = "testsecret"

from api import app, load_db, db_lock, load_billing_db
from auth import _active_sessions

client = TestClient(app)

print("Attempting login...")
res = client.post("/api/login", json={"password": "123"})
print(res.status_code, res.json())
token = res.json().get("token")

print("Attempting to get passkeys status...")
res2 = client.get("/api/passkeys/status", headers={"Authorization": f"Bearer {token}"})
print(res2.status_code, res2.json())

print("Attempting to get keys...")
res3 = client.get("/api/keys", headers={"Authorization": f"Bearer {token}"})
print(res3.status_code, res3.json())

print("Clearing active sessions to simulate restart...")
_active_sessions.clear()

print("Attempting to get passkeys status after restart...")
res4 = client.get("/api/passkeys/status", headers={"Authorization": f"Bearer {token}"})
print(res4.status_code, res4.json())

print("Attempting to get keys after restart...")
res5 = client.get("/api/keys", headers={"Authorization": f"Bearer {token}"})
print(res5.status_code, res5.json())
