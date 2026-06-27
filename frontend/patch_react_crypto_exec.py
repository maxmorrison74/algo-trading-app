import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# Add the simulation badge and virtual portfolio
old_header = """        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>DeFi Arbitrage (BTC/USDT)</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.9rem' }}>Scansione istantanea su Exchange Centralizzati</div>
        </div>"""

new_header = """        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>DeFi Arbitrage (BTC/USDT) <span style={{ fontSize: '0.8rem', background: '#f59e0b', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '1rem' }}>MODALITÀ SIMULAZIONE ATTIVA</span></h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.9rem' }}>Esecuzione automatica live (Paper Trading)</div>
          <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'inline-block' }}>
            <span style={{ color: '#94a3b8', marginRight: '1rem' }}>Portafoglio Virtuale:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>${Number(status.portfolio_value || 0).toFixed(2)}</span>
          </div>
        </div>"""

if "MODALITÀ SIMULAZIONE ATTIVA" not in content:
    content = content.replace(old_header, new_header)

with open(file_path, 'w') as f:
    f.write(content)

print("OmniApp patched with Crypto execution badge.")
