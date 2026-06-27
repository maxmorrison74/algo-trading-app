import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

old_portfolio = """
              <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold' }}>{sym} {p.side === 'short' ? '(SHORT)' : ''}</span>
                {p === "LIQUID" ? (
                  <span style={{ color: '#94a3b8' }}>IN ATTESA</span>
                ) : (
                  <span style={{ color: p.unrealized_pl >= 0 ? '#10b981' : '#ef4444' }}>
                    {p.unrealized_pl >= 0 ? '+' : ''}{Number(p.unrealized_pl || 0).toFixed(2)}$ ({Number(p.unrealized_plpc || 0).toFixed(2)}%)
                  </span>
                )}
              </div>
"""

new_portfolio = """
              <div key={sym} style={{ display: 'flex', flexDirection: 'column', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{sym} {p.side === 'short' ? '(SHORT)' : ''}</span>
                  {p === "LIQUID" ? (
                    <span style={{ color: '#94a3b8' }}>IN ATTESA</span>
                  ) : (
                    <span style={{ color: p.unrealized_pl >= 0 ? '#10b981' : '#ef4444' }}>
                      {p.unrealized_pl >= 0 ? '+' : ''}{Number(p.unrealized_pl || 0).toFixed(2)}$ ({Number(p.unrealized_plpc || 0).toFixed(2)}%)
                    </span>
                  )}
                </div>
                {/* AI Sentiment Integration */}
                {status.table_data && status.table_data.find(r => r.symbol === sym) && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    <span style={{ color: '#64748b', marginRight: '0.5rem' }}>🧠 AI Sentiment:</span>
                    {status.table_data.find(r => r.symbol === sym).sentiment === 'BULLISH' && <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 BULLISH (+15% Boost)</span>}
                    {status.table_data.find(r => r.symbol === sym).sentiment === 'BEARISH' && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 BEARISH (VETO Attivo)</span>}
                    {status.table_data.find(r => r.symbol === sym).sentiment === 'NEUTRAL' && <span style={{ color: '#94a3b8' }}>⚪ NEUTRAL</span>}
                  </div>
                )}
              </div>
"""

if "AI Sentiment Integration" not in content:
    content = content.replace(old_portfolio.strip(), new_portfolio.strip())

with open(file_path, 'w') as f:
    f.write(content)

print("React UI fixed with AI Sentiment.")
