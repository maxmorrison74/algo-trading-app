import os
import re

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update overall headers
content = content.replace("Algo-Trading & Scalping", "ALGO-TRADING ENGINE")
content = content.replace("color: '#f8fafc'", "color: 'var(--text-primary)', fontFamily: 'var(--font-mono)'")
content = content.replace("color: '#94a3b8'", "color: 'var(--text-secondary)'")

# 2. Update Portfolio Value styling to use .mono
old_portfolio = """<div className="portfolio-value">
            ${Number(status.portfolio_value || 0).toFixed(2)}
          </div>"""
new_portfolio = """<div className="portfolio-value value-green mono">
            ${Number(status.portfolio_value || 0).toFixed(2)}
          </div>"""
content = content.replace(old_portfolio, new_portfolio)

# 3. Update the logs to use .terminal-window
old_logs = """<div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="card-title">Live Trading Logs</h3>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.875rem', color: '#94a3b8' }}>
          {status.logs?.map((l, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <span style={{ color: '#06b6d4' }}>[{new Date(l.timestamp).toLocaleTimeString()}]</span> {l.msg}
            </div>
          ))}
        </div>
      </div>"""
new_logs = """<div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="card-title">LIVE TERMINAL</h3>
        <div className="terminal-window">
          {status.logs?.map((l, i) => (
            <div key={i} className="terminal-line">
              <span className="timestamp highlight">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
              <span className="mono">{l.msg}</span>
            </div>
          ))}
        </div>
      </div>"""
content = content.replace(old_logs, new_logs)

# 4. Update the position rows
old_positions = """{Object.entries(status.positions || {}).map(([sym, p]) => (
            <div key={sym} className="asset-row">
              <div>
                <strong style={{ color: '#f8fafc' }}>{sym}</strong>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', padding: '2px 6px', background: p === 'LIQUID' ? 'rgba(255,255,255,0.1)' : (p.side === 'long' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'), color: p === 'LIQUID' ? '#ccc' : (p.side === 'long' ? '#10b981' : '#ef4444'), borderRadius: '4px' }}>
                  {p === 'LIQUID' ? 'LIQUID' : p.side.toUpperCase()}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {p !== 'LIQUID' ? (
                  <>
                    <div style={{ color: '#f8fafc' }}>{p.qty} shares</div>
                    <div style={{ fontSize: '0.8rem', color: Number(p.unrealized_pl) >= 0 ? '#10b981' : '#ef4444' }}>
                      {Number(p.unrealized_pl) >= 0 ? '+' : ''}{Number(p.unrealized_pl).toFixed(2)}$
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Attesa Segnale...</div>
                )}
              </div>
            </div>
          ))}"""

new_positions = """{Object.entries(status.positions || {}).map(([sym, p]) => (
            <div key={sym} className="data-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{sym}</strong>
                <span className={`badge ${p === 'LIQUID' ? 'badge-neutral' : (p.side === 'long' ? 'badge-long' : 'badge-short')}`}>
                  {p === 'LIQUID' ? 'LIQ' : p.side.toUpperCase()}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {p !== 'LIQUID' ? (
                  <>
                    <div className="mono" style={{ color: 'var(--text-primary)' }}>{p.qty} QTY</div>
                    <div className="mono" style={{ fontSize: '0.8rem', color: Number(p.unrealized_pl) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {Number(p.unrealized_pl) >= 0 ? '+' : ''}{Number(p.unrealized_pl).toFixed(2)}$
                    </div>
                  </>
                ) : (
                  <div className="mono" style={{ color: 'var(--text-muted)' }}>WAITING...</div>
                )}
              </div>
            </div>
          ))}"""
content = content.replace(old_positions, new_positions)

# 5. Update AI Predictions box
old_ai = """<div className="card">
          <h3 className="card-title">AI & Sentiment Signals</h3>
          {Object.entries(status.latest_predictions || {}).map(([sym, pred]) => (
            <div key={sym} className="asset-row">
              <strong style={{ color: '#f8fafc' }}>{sym}</strong>
              <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{pred}</span>
            </div>
          ))}
          {Object.keys(status.latest_predictions || {}).length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>In attesa del prossimo ciclo di analisi...</div>
          )}
        </div>"""

new_ai = """<div className="card">
          <h3 className="card-title">ENSEMBLE SIGNALS (AI + TA)</h3>
          {Object.entries(status.latest_predictions || {}).map(([sym, pred]) => {
            // Pred format: "72.5% | RSI:35📊 | MACD:🟢"
            let probColor = 'var(--accent-cyan)';
            if (pred.includes('%')) {
              let probNum = parseFloat(pred.split('%')[0]);
              if (probNum > 60) probColor = 'var(--accent-green)';
              else if (probNum < 40) probColor = 'var(--accent-red)';
            }
            return (
              <div key={sym} className="data-row">
                <strong style={{ color: 'var(--text-primary)', width: '80px' }}>{sym}</strong>
                <span className="mono" style={{ color: probColor, flex: 1, textAlign: 'right' }}>{pred}</span>
              </div>
            );
          })}
          {Object.keys(status.latest_predictions || {}).length === 0 && (
            <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>[SCANNING MARKET DATA...]</div>
          )}
        </div>"""
content = content.replace(old_ai, new_ai)

# 6. Make input boxes use .mono
content = content.replace("style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', marginBottom: '1rem' }}", 'className="mono" style={{ marginBottom: "1rem" }}')
content = content.replace("style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc' }}", 'className="mono"')

with open(file_path, 'w') as f:
    f.write(content)

print("OmniApp.jsx UI patched.")
