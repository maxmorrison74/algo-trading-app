import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

sports_view = """
  const renderSportsArbitrageView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>Sports SureBets ⚽🎾</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.9rem' }}>Calcolatore Matematico di Scommesse Sicure</div>
        </div>
        <button 
          className={`btn ${status.modules?.sports_arb ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('sports_arb', status.modules?.sports_arb)}
        >
          {status.modules?.sports_arb ? 'FERMA RADAR QUOTE' : 'ATTIVA RADAR QUOTE'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Radar Logs */}
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Radar Bookmakers Live</h3>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            {status.sports_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("SUREBET") ? '#10b981' : '#64748b' }}>{l}</div>
            ))}
            {(!status.sports_logs || status.sports_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di connessione ai flussi quote...</div>
            )}
          </div>
        </div>

        {/* SureBets Found */}
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Ultime SureBets Trovate</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {status.active_surebets?.map(sb => (
              <div key={sb.id} style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{sb.match}</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>Profitto: +{Number(sb.profit_margin || 0).toFixed(2)}%</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>PUNTA SU {sb.p1.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book1} (@{Number(sb.odds1 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake1 || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>PUNTA SU {sb.p2.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book2} (@{Number(sb.odds2 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake2 || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.5)', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', color: '#e2e8f0' }}>
                  Investimento Totale: <strong>€100.00</strong> ➔ Ritorno Garantito: <strong style={{ color: '#10b981' }}>€{Number(sb.guaranteed_return || 0).toFixed(2)}</strong>
                </div>
              </div>
            ))}
            
            {(!status.active_surebets || status.active_surebets.length === 0) && (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#94a3b8' }}>
                Nessuna SureBet attiva al momento. Il Radar è in scansione...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
"""

if "const renderSportsArbitrageView = () => (" not in content:
    content = content.replace("const renderComingSoon", sports_view + "\n  const renderComingSoon")

# Replace activeTab logic
old_render = "{activeTab === 'sports_arb' && renderComingSoon('Scommesse Sportive (SureBets)', 'sports_arb', 'Scanner API dei bookmaker mondiali (Bet365, Pinnacle, ecc.) per scovare quote sbilanciate su cui scommettere su tutti i risultati vincendo matematicamente.')}"
new_render = "{activeTab === 'sports_arb' && renderSportsArbitrageView()}"
content = content.replace(old_render, new_render)

with open(file_path, 'w') as f:
    f.write(content)

print("Sports Arbitrage UI added to OmniApp.")
