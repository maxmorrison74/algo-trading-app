import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: '2rem'}}>
        <h2>React Crash!</h2>
        <pre>{this.state.error.toString()}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function OmniApp() {
  const [status, setStatus] = useState({});
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [activeTab, setActiveTab] = useState('trading');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (!data.error) {
          setStatus(data);
          if (!selectedSymbol && data.symbols && data.symbols.length > 0) {
            setSelectedSymbol(data.symbols[0]);
          }
        }
      } catch (err) {
        console.error("Backend offline");
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const fetchChart = async () => {
      try {
        const safeSym = encodeURIComponent(selectedSymbol);
        const res = await fetch(`/api/chart-data/${safeSym}?timeframe=${timeframe}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setChartData(data);
        } else {
          setChartData([]);
        }
      } catch (err) {
        setChartData([]);
      }
    };
    fetchChart();
  }, [selectedSymbol, timeframe]);

  const toggleModule = async (mod_id, isActive) => {
    await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: mod_id, active: !isActive })
    });
  };

  const handleReset = async () => {
    if (window.confirm("Sei sicuro di voler resettare la simulazione a $100.0 e cancellare la cronologia?")) {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        if (!data.error) setStatus(data.state);
      } catch (err) {
        alert("Errore di connessione al backend!");
      }
    }
  };

  // Rendering Helper per Trading
  const renderTradingView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>Algo-Trading & Scalping</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: status.market_open ? '#10b981' : '#f59e0b' }}></div>
            Market {status.market_open ? 'Open' : 'Closed'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className={`btn ${status.modules?.trading ? 'btn-stop' : 'btn-start'}`}
              onClick={() => toggleModule('trading', status.modules?.trading)}
            >
              {status.modules?.trading ? 'FERMA SCANNER' : 'AVVIA SCANNER AUTOMATICO'}
            </button>
            <button className="btn btn-stop" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)' }} onClick={handleReset}>
              RESET SIMULAZIONE
            </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
        <div className="stat-card">
          <div className="stat-title">Portafoglio Virtuale</div>
          <div className="stat-value">${Number(status.portfolio_value || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Capitale Investito</div>
          <div className="stat-value">
            ${(Object.values(status.positions || {}).reduce((sum, p) => sum + (p !== "LIQUID" ? Math.abs(p.market_value || 0) : 0), 0)).toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Liquidità Libera</div>
          <div className="stat-value" style={{ color: '#10b981' }}>${Number(status.cash || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">P/L Tempo Reale</div>
          <div className="stat-value" style={{ color: Number(status.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
            {Number(status.profit || 0) >= 0 ? '+' : ''}{Number(status.profit || 0).toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Win Rate</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{Number(status.win_rate || 0).toFixed(1)}%</div>
        </div>
      </div>

      <div className="chart-controls" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {status.symbols?.map(sym => (
            <button key={sym} className={`tab-btn ${selectedSymbol === sym ? 'active-tab' : ''}`} onClick={() => setSelectedSymbol(sym)}>{sym}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['1D', '1W', '1M', '1Y', 'ALL'].map(tf => (
            <button key={tf} className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>{tf}</button>
          ))}
        </div>
      </div>

      <div className="chart-container" style={{ height: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Portafoglio Corrente</h3>
          {Object.entries(status.positions || {}).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Nessuna posizione aperta. Il bot sta scansionando...</p>
          ) : (
            Object.entries(status.positions).map(([sym, p]) => (
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
            ))
          )}
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Impostazioni IA</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Soglia Aggressività IA</label>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>{status.aggressiveness || 55}%</span>
            </div>
            <input 
              type="range" min="10" max="90" step="1"
              value={status.aggressiveness || 55}
              onChange={async (e) => {
                const val = e.target.value;
                setStatus(prev => ({ ...prev, aggressiveness: val }));
                await fetch('/api/config', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ aggressiveness: val })
                });
              }}
              style={{ width: '100%', accentColor: '#06b6d4' }}
            />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Terminale Scansione</h3>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '350px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981' }}>
            {status.logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.3rem' }}>{l}</div>
            ))}
            {status.logs?.length === 0 && <div>In attesa di connessione...</div>}
          </div>
        </div>
      </div>
    </div>
  );

  
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

  const renderComingSoon = (title, mod_id, description) => (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#f8fafc' }}>{title}</h2>
      <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>{description}</p>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Stato Modulo</h3>
        <button 
          className={`btn ${status.modules?.[mod_id] ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule(mod_id, status.modules?.[mod_id])}
          style={{ fontSize: '1.2rem', padding: '1rem 3rem' }}
        >
          {status.modules?.[mod_id] ? 'DISATTIVA MOTORE' : 'ATTIVA MOTORE'}
        </button>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
          {status.modules?.[mod_id] ? 'Il motore è attivo e gira in background.' : 'Attualmente in pausa.'}
        </p>
      </div>
    </div>
  );

  return (
  <ErrorBoundary>
    <div className="omni-app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 style={{ fontSize: '1.4rem', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            OMNI-PROFIT
          </h1>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>V2.0 OS FINANZIARIO</div>
        </div>
        
        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Algo-Trading
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
            <span className="menu-icon">⛓️</span> DeFi Arbitrage
            {status.modules?.crypto_arb && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'sports_arb' ? 'active' : ''}`} onClick={() => setActiveTab('sports_arb')}>
            <span className="menu-icon">⚽</span> Sports SureBets
            {status.modules?.sports_arb && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'ai_content' ? 'active' : ''}`} onClick={() => setActiveTab('ai_content')}>
            <span className="menu-icon">📱</span> AI Content Creator
            {status.modules?.ai_content && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
            <span className="menu-icon">💳</span> SaaS & Billing
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div>Connesso a server sicuro</div>
          <div style={{ color: '#10b981', marginTop: '0.2rem' }}>All Systems Nominal</div>
        </div>
      </div>
      
      <div className="main-content">
        {activeTab === 'trading' && renderTradingView()}
        {activeTab === 'crypto_arb' && renderArbitrageView()}
        {activeTab === 'sports_arb' && renderComingSoon('Sports Arbitrage (SureBets)', 'sports_arb', 'Si collega alle API mondiali delle scommesse sportive per trovare e piazzare quote in cui il guadagno è garantito a prescindere dal risultato.')}
        {activeTab === 'ai_content' && renderComingSoon('AI Faceless Content Creator', 'ai_content', 'Un motore autonomo che legge le news, genera script, registra la voce e carica video virali su TikTok e YouTube Shorts.')}
        {activeTab === 'saas' && (
           <div className="module-content" style={{ padding: '2rem' }}>
             <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f8fafc' }}>Gestione SaaS & Clienti</h2>
             <p style={{ color: '#94a3b8' }}>Da qui potrai generare i link Stripe e gestire gli utenti paganti che si iscrivono al tuo ecosistema.</p>
           </div>
        )}
      </div>
    </div>
  </ErrorBoundary>
  );
}

export default OmniApp;
