import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Power, TrendingUp, AlertCircle, Cpu } from 'lucide-react';

function App() {
  const [status, setStatus] = useState({
    is_running: false,
    portfolio_value: 10000.00,
    positions: {},
    predictions: {},
    last_trade: "Nessuna operazione",
    symbols: ["NVDA", "TSLA", "AAPL", "AMD", "MRNA"],
    logs: [],
    market_open: false
  });
  
  const [chartData, setChartData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");
  const [timeframe, setTimeframe] = useState("1M");
  
  // Per tracciare l'apertura
  const [prevMarketOpen, setPrevMarketOpen] = useState(false);

  // Fetch status every 2 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (!data.error) {
          setStatus(data);
          // Controlliamo se il mercato è appena aperto
          if (data.market_open && !prevMarketOpen) {
            setPrevMarketOpen(true);
            // Rimosso l'avviso sonoro e le notifiche browser su richiesta dell'utente
          } else if (!data.market_open && prevMarketOpen) {
            setPrevMarketOpen(false); // mercato chiuso
          }
        }
      } catch (err) {
        console.error("Backend non raggiungibile", err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch chart data when selected symbol or timeframe changes
  useEffect(() => {
    const fetchChart = async () => {
      try {
        const res = await fetch(`/api/chart-data/${selectedSymbol}?timeframe=${timeframe}`);
        const data = await res.json();
        setChartData(data);
      } catch (err) {
        console.error("Errore grafico", err);
      }
    };
    fetchChart();
  }, [selectedSymbol, timeframe]);

  const handleToggleBot = async () => {
    const endpoint = status.is_running ? '/api/stop' : '/api/start';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!data.error) setStatus(data.state);
    } catch (err) {
      alert("Errore di connessione al backend!");
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="brand">
          <Cpu size={32} className="brand-icon" />
          <h1 className="title">Morrison iA Scanner</h1>
        </div>
        <div className="status-badge" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.8rem', borderRadius: '20px' }}>
            <div className={`status-dot ${status.market_open ? 'active' : 'inactive'} ${!status.market_open && 'bg-red-500'}`} style={{ backgroundColor: status.market_open ? '#10b981' : '#ef4444' }}></div>
            {status.market_open ? 'WALL STREET APERTA' : 'WALL STREET CHIUSA'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.8rem', borderRadius: '20px' }}>
            <div className={`status-dot ${status.is_running ? 'active' : 'inactive'}`}></div>
            {status.is_running ? 'SCANNER ONLINE' : 'SYSTEM OFFLINE'}
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="main-content">
          <div className="card">
            <h2 className="card-title">Riepilogo Capitale</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 16%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Valore Totale</div>
                <div className="portfolio-value value-green" style={{ fontSize: '1.8rem' }}>
                  ${(status.portfolio_value || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 16%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Capitale Investito</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>
                  ${(Object.values(status.positions || {}).reduce((sum, p) => sum + (p !== "LIQUID" ? Math.abs(p.market_value || 0) : 0), 0)).toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 16%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Liquidità Libera</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                  ${(status.cash || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 16%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>P/L Tempo Reale</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: (status.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {(status.profit || 0) >= 0 ? '+' : ''}${(status.profit || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 16%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Win Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {(status.win_rate || 0).toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="chart-controls" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {status.symbols?.map(sym => (
                  <button 
                    key={sym} 
                    className={`tab-btn ${selectedSymbol === sym ? 'active-tab' : ''}`}
                    onClick={() => setSelectedSymbol(sym)}
                  >
                    {sym}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['1D', '1W', '1M', '1Y', 'ALL'].map(tf => (
                  <button 
                    key={tf} 
                    className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#06b6d4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#06b6d4" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 8, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="trade-history-container" style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>CRONOLOGIA OPERAZIONI</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Data</th>
                    <th style={{ padding: '0.5rem' }}>Asset</th>
                    <th style={{ padding: '0.5rem' }}>Side</th>
                    <th style={{ padding: '0.5rem' }}>Profitto ($)</th>
                    <th style={{ padding: '0.5rem' }}>Profitto (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(status.trade_history || []).slice().reverse().map((trade, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>{trade.date}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{trade.symbol}</td>
                      <td style={{ padding: '0.5rem', color: trade.side === 'long' ? '#38bdf8' : '#f472b6' }}>{trade.side.toUpperCase()}</td>
                      <td style={{ padding: '0.5rem', color: trade.profit_usd >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {trade.profit_usd >= 0 ? '+' : ''}{trade.profit_usd}
                      </td>
                      <td style={{ padding: '0.5rem', color: trade.profit_pct >= 0 ? '#10b981' : '#ef4444' }}>
                        {trade.profit_pct >= 0 ? '+' : ''}{trade.profit_pct}%
                      </td>
                    </tr>
                  ))}
                  {(!status.trade_history || status.trade_history.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Nessuna operazione conclusa al momento</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="card" style={{ marginTop: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            <h2 className="card-title">Log Operazioni</h2>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#10b981',
              backgroundColor: '#0f172a',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {status.logs && status.logs.length > 0 ? (
                status.logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '0.25rem' }}>{log}</div>
                ))
              ) : (
                <div style={{ color: '#94a3b8' }}>In attesa di operazioni...</div>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="card controls-card">
            <h2 className="card-title">Controllo IA & Scanner</h2>
            
            <button 
              className={`btn ${status.is_running ? 'btn-stop' : 'btn-start'}`}
              onClick={handleToggleBot}
            >
              <Power size={20} />
              {status.is_running ? 'FERMA SCANNER & LIQUIDA TUTTO' : 'AVVIA SCANNER AUTOMATICO'}
            </button>
            
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Soglia Aggressività IA</label>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>{status.aggressiveness || 55}%</span>
              </div>
              <input 
                type="range" 
                min="50" max="80" step="1"
                value={status.aggressiveness || 55}
                onChange={async (e) => {
                  const val = e.target.value;
                  setStatus(prev => ({ ...prev, aggressiveness: val }));
                  await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aggressiveness: val })
                  });
                }}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#06b6d4' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: '#64748b' }}>
                <span>Aggressivo (50%)</span>
                <span>Cauto (80%)</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div className="info-row">
                <span className="info-label">Ultima Azione:</span>
                <span className="info-value" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{status.last_trade}</span>
              </div>
            </div>

            <div className="asset-list" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Stato Asset Monitorati</h3>
              {status.symbols?.map(sym => {
                const pos = status.positions[sym] || "LIQUID";
                const isLiquid = pos === "LIQUID";
                const pred = status.predictions[sym] || "In attesa";
                const isUp = pred.includes("UP");
                
                return (
                  <div key={sym} className="asset-row" onClick={() => setSelectedSymbol(sym)} style={{ cursor: 'pointer', padding: '0.8rem', background: isLiquid ? 'transparent' : 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '0.5rem', border: isLiquid ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: !isLiquid ? '#10b981' : '#94a3b8' }}></div>
                        <strong style={{ width: '50px' }}>{sym}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: isUp ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{pred}</div>
                    </div>
                    
                    {!isLiquid && (
                      <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#10b981', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Proprietà: <b>{pos.qty.toFixed(4)}</b> az.</span>
                        <span>Valore: <b>${pos.market_value.toFixed(2)}</b></span>
                      </div>
                    )}
                    {isLiquid && (
                      <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Nessuna posizione aperta
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
