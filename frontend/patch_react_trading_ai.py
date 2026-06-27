import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update the table to use table_data
old_table_header = """            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '0.8rem 0' }}>Asset</th>
                  <th style={{ padding: '0.8rem 0' }}>Posizione / Qty</th>
                  <th style={{ padding: '0.8rem 0' }}>Momentum Score</th>
                </tr>
              </thead>"""

new_table_header = """            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', color: '#e2e8f0', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '0.8rem 0' }}>Asset</th>
                  <th style={{ padding: '0.8rem 0' }}>Posizione / Qty</th>
                  <th style={{ padding: '0.8rem 0' }}>Momentum Score</th>
                  <th style={{ padding: '0.8rem 0' }}>🧠 AI Sentiment</th>
                </tr>
              </thead>"""

if "🧠 AI Sentiment" not in content:
    content = content.replace(old_table_header, new_table_header)

old_table_body = """              <tbody>
                {status.target_symbols?.map(sym => (
                  <tr key={sym} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.8rem 0', fontWeight: 'bold' }}>{sym}</td>
                    <td style={{ padding: '0.8rem 0', color: status.predictions?.[sym] === 'LIQUID' ? '#94a3b8' : '#38bdf8' }}>
                      {/* Temporary hardcoded 'LIQUID' for simplicity if not in positions */}
                      LIQUID
                    </td>
                    <td style={{ padding: '0.8rem 0', color: (status.predictions?.[sym] || '').includes('UP') ? '#10b981' : '#f59e0b' }}>
                      {status.predictions?.[sym] || 'In attesa'}
                    </td>
                  </tr>
                ))}
              </tbody>"""

new_table_body = """              <tbody>
                {status.table_data?.map(row => (
                  <tr key={row.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.8rem 0', fontWeight: 'bold' }}>{row.symbol}</td>
                    <td style={{ padding: '0.8rem 0', color: row.position === 'LIQUID' ? '#94a3b8' : '#38bdf8' }}>
                      {row.position === 'LIQUID' ? 'LIQUID' : `${row.position.side} - Qty: ${row.position.qty} ($${row.position.market_value})`}
                    </td>
                    <td style={{ padding: '0.8rem 0', color: (row.prediction || '').includes('UP') ? '#10b981' : '#f59e0b' }}>
                      {row.prediction || 'In attesa'}
                    </td>
                    <td style={{ padding: '0.8rem 0' }}>
                      {row.sentiment === 'BULLISH' && <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>🟢 BULLISH (+15%)</span>}
                      {row.sentiment === 'BEARISH' && <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>🔴 BEARISH (VETO)</span>}
                      {row.sentiment === 'NEUTRAL' && <span style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚪ NEUTRAL</span>}
                    </td>
                  </tr>
                ))}
                {(!status.table_data || status.table_data.length === 0) && (
                  <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Nessun asset scansionato.</td></tr>
                )}
              </tbody>"""

if "row.sentiment === 'BULLISH'" not in content:
    content = content.replace(old_table_body, new_table_body)

with open(file_path, 'w') as f:
    f.write(content)

print("React UI patched with AI Trading column.")
