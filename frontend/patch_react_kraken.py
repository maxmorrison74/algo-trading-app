import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

search_str = """      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Altri Servizi</h3>"""

kraken_block = """      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Kraken (Crypto Arb)</h3>
          <button onClick={() => testConnection('kraken')} style={{ background: 'transparent', border: '1px solid #06b6d4', color: '#06b6d4', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.kraken_key} onChange={e => setApiKeys({...apiKeys, kraken_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.kraken_secret} onChange={e => setApiKeys({...apiKeys, kraken_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['kraken'] && <div style={{ color: testResults['kraken'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['kraken']}</div>}
      </div>

"""

if "Kraken (Crypto Arb)" not in content:
    content = content.replace(search_str, kraken_block + search_str)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Kraken input added.")
else:
    print("Kraken input already exists.")
