import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

arb_view = """
  const renderArbitrageView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>DeFi Arbitrage (BTC/USDT)</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.9rem' }}>Scansione istantanea su Exchange Centralizzati</div>
        </div>
        <button 
          className={`btn ${status.modules?.crypto_arb ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('crypto_arb', status.modules?.crypto_arb)}
        >
          {status.modules?.crypto_arb ? 'FERMA ARBITRAGGIO' : 'ATTIVA MOTORE ARBITRAGGIO'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <img src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png" alt="Binance" style={{ height: '40px', marginBottom: '1rem' }} />
          <h3 style={{ color: '#e2e8f0', margin: 0 }}>Binance (Ask)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#06b6d4', marginTop: '1rem' }}>
            ${Number(status.arb_prices?.binance || 0).toFixed(2)}
          </div>
        </div>

        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <img src="https://cryptologos.cc/logos/kraken-kcs-logo.png" alt="Kraken" style={{ height: '40px', marginBottom: '1rem', filter: 'grayscale(100%) brightness(200%)' }} />
          <h3 style={{ color: '#e2e8f0', margin: 0 }}>Kraken (Ask)</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6', marginTop: '1rem' }}>
            ${Number(status.arb_prices?.kraken || 0).toFixed(2)}
          </div>
        </div>
        
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
          <h3 style={{ color: '#10b981', margin: 0, fontSize: '1rem' }}>Spread Attuale</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.5rem' }}>
            {Math.abs(Number(status.arb_prices?.binance || 0) - Number(status.arb_prices?.kraken || 0)).toFixed(2)}$
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Soglia profitto netto: ~120$ (0.2%)</div>
        </div>
      </div>

      <h3 style={{ color: '#e2e8f0', marginTop: '3rem', marginBottom: '1rem' }}>Radar Inefficienze</h3>
      <div style={{ background: '#000', padding: '1.5rem', borderRadius: '8px', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        {status.arb_logs?.map((l, i) => (
          <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("TROVATO") ? '#f59e0b' : '#10b981' }}>{l}</div>
        ))}
        {(!status.arb_logs || status.arb_logs.length === 0) && (
          <div style={{ color: '#64748b' }}>Radar inattivo. Clicca su Attiva Motore Arbitraggio per iniziare la scansione dei due Exchange...</div>
        )}
      </div>
    </div>
  );
"""

if "const renderArbitrageView = () => (" not in content:
    content = content.replace("const renderComingSoon", arb_view + "\n  const renderComingSoon")

# Replace activeTab logic
old_render = "{activeTab === 'crypto_arb' && renderComingSoon('Arbitraggio DeFi & Flash Loans', 'crypto_arb', 'Scansiona DEX e CEX per trovare differenze di prezzo e compiere arbitraggio senza rischi matematici.')}"
new_render = "{activeTab === 'crypto_arb' && renderArbitrageView()}"
content = content.replace(old_render, new_render)

with open(file_path, 'w') as f:
    f.write(content)

print("Arbitrage UI added to OmniApp.")
