import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

old_test_conn = """  const testConnection = async (service) => {
    setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service})
      });"""

new_test_conn = """  const testConnection = async (service) => {
    setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service, ...apiKeys})
      });"""

content = content.replace(old_test_conn, new_test_conn)

old_fetch_keys1 = """const res = await fetch('/api/keys');"""
new_fetch_keys1 = """const res = await fetch('/api/keys?t=' + Date.now());"""
content = content.replace(old_fetch_keys1, new_fetch_keys1)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched testConnection and fetch cache.")
