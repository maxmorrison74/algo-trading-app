import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

old_save_keys = """  const saveKeys = async () => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(apiKeys)
      });
      alert('Chiavi salvate con successo nel Vault Sicuro!');
    } catch(err) {
      alert('Errore durante il salvataggio');
    }
  };"""

new_save_keys = """  const saveKeys = async () => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(apiKeys)
      });
      alert('Chiavi salvate con successo nel Vault Sicuro!');
      // Refetch keys immediately so dots appear
      const refetchRes = await fetch('/api/keys');
      const data = await refetchRes.json();
      setSavedKeys(data);
    } catch(err) {
      alert('Errore durante il salvataggio');
    }
  };"""

if "refetchRes" not in content:
    content = content.replace(old_save_keys, new_save_keys)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched saveKeys refetch.")
