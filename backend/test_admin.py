import requests
import time

res = requests.post('http://127.0.0.1:8000/api/login', json={'password': '123'})
print("LOGIN:", res.status_code, res.json())
token = res.json().get('token')

res2 = requests.get('http://127.0.0.1:8000/api/keys', headers={'Authorization': f'Bearer {token}'})
print("KEYS:", res2.status_code, res2.json())

res3 = requests.get('http://127.0.0.1:8000/api/passkeys/status', headers={'Authorization': f'Bearer {token}'})
print("PASSKEYS:", res3.status_code, res3.json())
