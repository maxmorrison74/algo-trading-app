import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
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

  const [numValueBets, setNumValueBets] = useState(9);
  const [placedBets, setPlacedBets] = useState({});
  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', binance_key:'', binance_secret:'', kraken_key:'', kraken_secret:'', elevenlabs_key:'', theodds_key:'', gemini_key:'', newsapi_key:'', google_cloud_json:''});
  const [testResults, setTestResults] = useState({});
  const [savedKeys, setSavedKeys] = useState({});
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [aiIdea, setAiIdea] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  
  const checkAuthMemory = () => {
    const authTime = localStorage.getItem('omni_auth_time');
    if (authTime) {
      const elapsed = Date.now() - parseInt(authTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) {
        return true;
      }
    }
    return false;
  };
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuthMemory());

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status?t=' + Date.now());
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

  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setIsAuthenticated(true);
        localStorage.setItem('omni_auth_time', Date.now().toString());
        setLoginError('');
      } else {
        setLoginError('Accesso Negato: Password Errata');
      }
    } catch (err) {
      setLoginError('Errore di connessione al server');
    }
  };

  const toggleModule = async (mod_id, isActive) => {
    setStatus(prev => ({
      ...prev,
      modules: { ...(prev.modules || {}), [mod_id]: !isActive }
    }));
    try {
      await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: mod_id, active: !isActive })
      });
      // Il polling da 2 secondi rileverà automaticamente il nuovo stato
    } catch (err) {
      console.error(err);
    }
  };

  const placeBet = async (sb) => {
    if (placedBets[sb.id]) return; // già piazzata
    setPlacedBets(prev => ({ ...prev, [sb.id]: 'loading' }));
    try {
      const res = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: sb.match,
          sport: sb.sport,
          p1: sb.p1, book1: sb.book1, odds1: sb.odds1, stake1: sb.stake1,
          p2: sb.p2, book2: sb.book2, odds2: sb.odds2, stake2: sb.stake2,
          profit_margin: sb.profit_margin,
          guaranteed_return: sb.guaranteed_return,
          total_stake: 100.0
        })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setPlacedBets(prev => ({ ...prev, [sb.id]: 'placed' }));
      } else {
        setPlacedBets(prev => ({ ...prev, [sb.id]: 'error' }));
      }
    } catch {
      setPlacedBets(prev => ({ ...prev, [sb.id]: 'error' }));
    }
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
  
  
  const testConnection = async (service) => {
    setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service, ...apiKeys})
      });
      const data = await res.json();
      setTestResults(prev => ({...prev, [service]: data.message}));
    } catch(err) {
      setTestResults(prev => ({...prev, [service]: 'Errore di rete'}));
    }
  };

  const saveKeys = async () => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(apiKeys)
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Errore sconosciuto dal server');
      }
      alert('Chiavi salvate con successo nel Vault Sicuro!');
      // Refetch keys immediately so dots appear
      const refetchRes = await fetch('/api/keys');
      const data = await refetchRes.json();
      setSavedKeys(data);
    } catch(err) {
      alert('Errore durante il salvataggio: ' + err.message);
    }
  };

  
  useEffect(() => {
    if (activeTab === 'settings') {
      const fetchKeys = async () => {
        try {
          const res = await fetch('/api/keys?t=' + Date.now());
          const data = await res.json();
          if (data.ERROR) {
            alert("Errore critico dal backend nel leggere le chiavi: " + data.ERROR);
          }
          setSavedKeys(data);
          // PRE-POPULATE I CAMPI DI TESTO CON I PALLINI (o la stringa mascherata)
          setApiKeys(prev => ({
            ...prev,
            alpaca_key: data.ALPACA_KEY || '',
            alpaca_secret: data.ALPACA_SECRET || '',
            binance_key: data.BINANCE_KEY || '',
            binance_secret: data.BINANCE_SECRET || '',
            kraken_key: data.KRAKEN_KEY || '',
            kraken_secret: data.KRAKEN_SECRET || '',
            elevenlabs_key: data.ELEVENLABS_KEY || '',
            theodds_key: data.THEODDS_KEY || '',
            gemini_key: data.GEMINI_KEY || '',
            newsapi_key: data.NEWSAPI_KEY || ''
          }));
        } catch(err) {
          console.error("Error fetching keys", err);
          alert("Errore di rete durante il caricamento delle chiavi dal Vault.");
        }
      };
      fetchKeys();
    }
  }, [activeTab]);

  const renderSettingsView = () => (
    <div className="module-content">
      <div className="header" style={{ marginBottom: '2rem' }}>
        <h2>🔐 Security & API Vault</h2>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Gestione chiavi crittografate per le connessioni ai mercati reali.</div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Alpaca (Stock Market) {savedKeys['ALPACA_KEY'] && <span className='badge badge-long' style={{ marginLeft: '0.5rem' }}>SECURE</span>}</h3>
          <button onClick={() => testConnection('alpaca')} className="btn" style={{ padding: '0.5rem 1rem' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.alpaca_key} onChange={e => setApiKeys({...apiKeys, alpaca_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.alpaca_secret} onChange={e => setApiKeys({...apiKeys, alpaca_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['alpaca'] && <div style={{ color: testResults['alpaca'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['alpaca']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Binance (Crypto Arb) {savedKeys['BINANCE_KEY'] && <span className='badge badge-long' style={{ marginLeft: '0.5rem' }}>SECURE</span>}</h3>
          <button onClick={() => testConnection('binance')} className="btn" style={{ padding: '0.5rem 1rem' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.binance_key} onChange={e => setApiKeys({...apiKeys, binance_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.binance_secret} onChange={e => setApiKeys({...apiKeys, binance_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['binance'] && <div style={{ color: testResults['binance'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['binance']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Kraken (Crypto Arb) {savedKeys['KRAKEN_KEY'] && <span className='badge badge-long' style={{ marginLeft: '0.5rem' }}>SECURE</span>}</h3>
          <button onClick={() => testConnection('kraken')} className="btn" style={{ padding: '0.5rem 1rem' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.kraken_key} onChange={e => setApiKeys({...apiKeys, kraken_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.kraken_secret} onChange={e => setApiKeys({...apiKeys, kraken_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['kraken'] && <div style={{ color: testResults['kraken'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['kraken']}</div>}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={saveKeys} className="btn btn-start" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>Salva nel Vault Sicuro</button>
      </div>
    </div>
  );

  const renderHomeView = () => {
    const aiEarnings = status.ai_videos?.reduce((acc, v) => acc + (v.earnings || 0), 0) || 0;
    const tradingProfit = Number(status.profit || 0);
    const virtualCash = Number(status.virtual_cash || 100000);
    const totalWorth = virtualCash + (tradingProfit > 0 ? tradingProfit : 0) + aiEarnings;
    
    const pieData = [
      { name: 'Liquidità', value: virtualCash, color: 'var(--text-secondary)' },
      { name: 'Azioni (Trading)', value: Math.abs(tradingProfit) || 100, color: '#38bdf8' },
      { name: 'Crypto Arbitrage', value: status.modules?.crypto_arb ? 120.50 : 0, color: '#10b981' }
    ].filter(item => item.value > 0);

    return (
      <div className="module-content">
        <div className="header" style={{ marginBottom: '2rem' }}>
          <h2>Dashboard 📊</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Dashboard Aggregata delle Rendite Passive</div>
        </div>

        {/* Big Number */}
        <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
          <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
            ${totalWorth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2rem' }}>
          {/* Pie Chart Asset Allocation */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 1rem 0' }}>Asset Allocation</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard Moduli */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 1.5rem 0' }}>🏆 Leaderboard Moduli</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥇</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>Algo-Trading</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trading Quantitativo AI</div>
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${Math.abs(tradingProfit).toFixed(2)}</div>
              </div>



              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥈</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>DeFi Arbitrage</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spread BTC/USDT</div>
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${status.modules?.crypto_arb ? '120.50' : '0.00'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTradingView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>ALGO-TRADING ENGINE</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nessuna posizione aperta. Il bot sta scansionando...</p>
          ) : (
            Object.entries(status.positions).map(([sym, p]) => (
              <div key={sym} style={{ display: 'flex', flexDirection: 'column', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{sym} {p.side === 'short' ? '(SHORT)' : ''}</span>
                  {p === "LIQUID" ? (
                    <span style={{ color: 'var(--text-secondary)' }}>IN ATTESA</span>
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
                    {status.table_data.find(r => r.symbol === sym).sentiment === 'NEUTRAL' && <span style={{ color: 'var(--text-secondary)' }}>⚪ NEUTRAL</span>}
                  </div>
                )}
              </div>
            ))
          )}
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Impostazioni IA</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Soglia Aggressività IA</label>
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
          <h2>DeFi Arbitrage (BTC/USDT) <span className="badge badge-gold" style={{ marginLeft: '1rem', verticalAlign: 'middle' }}>MODALITÀ SIMULAZIONE ATTIVA</span></h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Esecuzione automatica live (Paper Trading)</div>
          <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'inline-block' }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Portafoglio Virtuale:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>${Number(status.portfolio_value || 0).toFixed(2)}</span>
          </div>
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

  
  const SPORT_LABELS = {
    soccer_italy_serie_a:        '⚽ Serie A',
    soccer_epl:                  '⚽ Premier League',
    soccer_spain_la_liga:        '⚽ La Liga',
    soccer_germany_bundesliga:   '⚽ Bundesliga',
    soccer_france_ligue_one:     '⚽ Ligue 1',
    soccer_uefa_champs_league:   '⚽ Champions League',
    soccer_uefa_european_championship: '⚽ Euro',
    soccer_usa_mls:              '⚽ MLS',
    tennis_atp_french_open:      '🎾 ATP Roland Garros',
    tennis_wta_french_open:      '🎾 WTA Roland Garros',
    tennis_atp_wimbledon:        '🎾 ATP Wimbledon',
    tennis_wta_wimbledon:        '🎾 WTA Wimbledon',
    basketball_nba:              '🏀 NBA',
    basketball_euroleague:       '🏀 Euroleague',
    americanfootball_nfl:        '🏈 NFL',
    icehockey_nhl:               '🏒 NHL',
    baseball_mlb:                '⚾ MLB',
  };
  const getSportLabel = (key) => SPORT_LABELS[key] || (key ? key.replace(/_/g, ' ').toUpperCase() : '🏆 Sport');

  const renderSportsArbitrageView = () => {
    const sortedSurebets = [...(status.active_surebets || [])].sort(
      (a, b) => Number(b.profit_margin || 0) - Number(a.profit_margin || 0)
    );
    return (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Sports SureBets ⚽🎾</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Calcolatore Matematico di Scommesse Sicure</div>
        </div>
        <button 
          className={`btn ${status.modules?.sports_arb ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('sports_arb', status.modules?.sports_arb)}
        >
          {status.modules?.sports_arb ? 'FERMA RADAR QUOTE' : 'ATTIVA RADAR QUOTE'}
        </button>
      </div>

      {/* --- Pannello Auto-Bet --- */}
      <div style={{
        background: status.auto_bet_enabled
          ? 'rgba(212,175,55,0.08)'
          : 'rgba(255,255,255,0.03)',
        border: status.auto_bet_enabled
          ? '1px solid rgba(212,175,55,0.5)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '1.2rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
        transition: 'all 0.3s'
      }}>
        {/* Toggle on/off */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontWeight: 'bold', color: '#e2e8f0', fontSize: '0.95rem' }}>🤖 Auto-Bet</span>
          <div
            onClick={async () => {
              const newVal = !status.auto_bet_enabled;
              setStatus(prev => ({ ...prev, auto_bet_enabled: newVal }));
              await fetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newVal })
              });
            }}
            style={{
              width: '52px', height: '28px',
              background: status.auto_bet_enabled
                ? 'linear-gradient(90deg, #d4af37, #f3e5ab)'
                : 'rgba(255,255,255,0.15)',
              borderRadius: '14px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.3s',
              flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '3px',
              left: status.auto_bet_enabled ? '26px' : '3px',
              width: '22px', height: '22px',
              background: '#fff',
              borderRadius: '50%',
              transition: 'left 0.3s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)'
            }} />
          </div>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 'bold',
            color: status.auto_bet_enabled ? '#d4af37' : '#64748b'
          }}>
            {status.auto_bet_enabled ? 'ATTIVO' : 'DISATTIVO'}
          </span>
        </div>

        {/* Slider soglia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: '220px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Soglia minima:</span>
          <input
            id="auto-bet-slider"
            type="range" min="1" max="30" step="0.5"
            value={status.auto_bet_threshold ?? 10}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setStatus(prev => ({ ...prev, auto_bet_threshold: val }));
            }}
            onMouseUp={async (e) => {
              const val = parseFloat(e.target.value);
              await fetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            onTouchEnd={async (e) => {
              const val = parseFloat(e.target.value);
              await fetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            style={{ flex: 1, accentColor: '#d4af37', cursor: 'pointer' }}
          />
          <span style={{
            fontWeight: 'bold',
            color: '#d4af37',
            minWidth: '42px',
            fontSize: '1rem'
          }}>{Number(status.auto_bet_threshold ?? 10).toFixed(1)}%</span>
        </div>

        {status.auto_bet_enabled && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Il sistema punta automaticamente €100 su ogni surebet ≥ {Number(status.auto_bet_threshold ?? 10).toFixed(1)}%
          </div>
        )}
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
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>SureBets — ordinate per profitto 📊</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
            {sortedSurebets.map((sb, idx) => (
              <div key={sb.id} style={{
                background: idx === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(16, 185, 129, 0.05)',
                padding: '1.5rem', borderRadius: '12px',
                border: Number(sb.profit_margin) >= 10
                  ? '2px solid rgba(212,175,55,0.8)'
                  : idx === 0 ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: Number(sb.profit_margin) >= 10 ? '0 0 12px rgba(212,175,55,0.25)' : 'none'
              }}>
                {/* Header card con sport, rank e profitto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {idx === 0 && <span style={{ fontSize: '1.1rem' }}>🥇</span>}
                    {idx === 1 && <span style={{ fontSize: '1.1rem' }}>🥈</span>}
                    {idx === 2 && <span style={{ fontSize: '1.1rem' }}>🥉</span>}
                    {idx > 2  && <span style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem' }}>#{idx + 1}</span>}
                    <span style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#60a5fa',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      border: '1px solid rgba(59,130,246,0.3)',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}>{getSportLabel(sb.sport)}</span>
                    {Number(sb.profit_margin) >= 10 && (
                      <span style={{
                        background: 'linear-gradient(90deg, #d4af37, #f3e5ab)',
                        color: '#000',
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        letterSpacing: '1px'
                      }}>🤖 AUTO</span>
                    )}
                  </div>
                  <span style={{ color: Number(sb.profit_margin) >= 10 ? '#d4af37' : '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>+{Number(sb.profit_margin || 0).toFixed(2)}%</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{sb.match}</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>PUNTA SU {sb.p1.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book1} (@{Number(sb.odds1 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake1 || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>PUNTA SU {sb.p2.toUpperCase()}</div>
                    <div style={{ fontWeight: 'bold' }}>{sb.book2} (@{Number(sb.odds2 || 0).toFixed(2)})</div>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '0.2rem' }}>Stake: €{Number(sb.stake2 || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.5)', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', color: '#e2e8f0', marginBottom: '1rem' }}>
                  Investimento Totale: <strong>€100.00</strong> ➔ Ritorno Garantito: <strong style={{ color: '#10b981' }}>€{Number(sb.guaranteed_return || 0).toFixed(2)}</strong>
                </div>

                {/* Bottone piazza scommessa */}
                {(() => {
                  const betState = placedBets[sb.id];
                  if (betState === 'placed') return (
                    <div style={{ textAlign: 'center', padding: '0.8rem', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      ✅ Scommessa piazzata! In attesa del risultato...
                    </div>
                  );
                  if (betState === 'error') return (
                    <div style={{ textAlign: 'center', padding: '0.8rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 'bold' }}>
                      ❌ Errore nel piazzare la scommessa.
                    </div>
                  );
                  return (
                    <button
                      onClick={() => placeBet(sb)}
                      disabled={betState === 'loading'}
                      style={{
                        width: '100%',
                        padding: '0.9rem',
                        background: betState === 'loading'
                          ? 'rgba(212,175,55,0.3)'
                          : 'linear-gradient(90deg, #d4af37, #f3e5ab)',
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: betState === 'loading' ? 'wait' : 'pointer',
                        letterSpacing: '1px',
                        transition: 'all 0.2s',
                      }}
                    >
                      {betState === 'loading' ? '⏳ Piazzando...' : '⚡ PIAZZA SCOMMESSA (€100)'}
                    </button>
                  );
                })()}
              </div>
            ))}
            
            {sortedSurebets.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                Nessuna SureBet attiva al momento. Il Radar è in scansione...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderValueBetsView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            🤖 AI Sentiment Radar
            <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              powered by NewsAPI & NLP
            </span>
          </h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Segnali di mercato dall'analisi del sentiment globale (Crypto & Stock)</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button 
            className={`toggle-btn ${status.modules?.ai_sports_sentiment ? 'active' : ''}`}
            onClick={() => toggleModule('ai_sports_sentiment')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <div className="toggle-switch"></div>
            {status.modules?.ai_sports_sentiment ? 'Radar Attivo' : 'Radar Spento'}
          </button>
        
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Mostra:</span>
          <input 
            type="range" min="3" max="50" step="3" 
            value={numValueBets} 
            onChange={(e) => setNumValueBets(parseInt(e.target.value))} 
            style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 'bold', color: '#a78bfa', minWidth: '24px' }}>{numValueBets}</span>
        </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {status.value_bets && status.value_bets.length > 0 ? (
          status.value_bets.slice(0, numValueBets).map(vb => (
            <div key={vb.id} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>
                    {vb.sport}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#f8fafc' }}>{vb.match}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px' }}>CONFIDENCE</div>
                  <div style={{ 
                    display: 'inline-block',
                    background: vb.compound > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: vb.compound > 0 ? '#10b981' : '#ef4444',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}>
                    {vb.confidence}%
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '10px',
                borderLeft: vb.compound > 0 ? '4px solid #10b981' : '4px solid #ef4444'
              }}>
                <a href={vb.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📰 {vb.title || "Notizia Sensibile Rilevata"}
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6' }}>↗️</span>
                  </div>
                </a>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>
                  "{vb.analysis}"
                </div>
              </div>

              {/* Progress bar sentiment */}
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${vb.confidence}%`, 
                  height: '100%', 
                  background: vb.compound > 0 ? 'linear-gradient(90deg, #047857, #10b981)' : 'linear-gradient(90deg, #b91c1c, #ef4444)',
                  float: vb.compound > 0 ? 'right' : 'left' 
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>CONSIGLIO AI</div>
                  <div style={{ fontWeight: 'bold', color: vb.compound > 0 ? '#10b981' : '#ef4444' }}>{vb.prediction}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>MOLTIPLICATORE</div>
                  <div style={{ fontWeight: 'bold', color: '#8b5cf6', fontSize: '1.2rem' }}>{vb.odds.toFixed(2)}x</div>
                </div>
              </div>
              <button
                onClick={async () => {
                  setPlacedBets(prev => ({ ...prev, [vb.id]: 'loading' }));
                  await new Promise(r => setTimeout(r, 1500));
                  if (Math.random() > 0.1) {
                    setPlacedBets(prev => ({ ...prev, [vb.id]: 'placed' }));
                  } else {
                    setPlacedBets(prev => ({ ...prev, [vb.id]: 'error' }));
                  }
                }}
                disabled={placedBets[vb.id] === 'loading' || placedBets[vb.id] === 'placed'}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.8rem',
                  background: placedBets[vb.id] === 'placed' 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : placedBets[vb.id] === 'error'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : placedBets[vb.id] === 'loading'
                        ? 'rgba(139, 92, 246, 0.3)'
                        : 'linear-gradient(90deg, #8b5cf6, #c084fc)',
                  border: placedBets[vb.id] === 'placed' 
                    ? '1px solid #10b981' 
                    : placedBets[vb.id] === 'error'
                      ? '1px solid #ef4444'
                      : 'none',
                  color: placedBets[vb.id] === 'placed' 
                    ? '#10b981' 
                    : placedBets[vb.id] === 'error'
                      ? '#ef4444'
                      : '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  borderRadius: '8px',
                  cursor: (placedBets[vb.id] === 'loading' || placedBets[vb.id] === 'placed') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {placedBets[vb.id] === 'loading' ? '⏳ Piazzando...' : 
                 placedBets[vb.id] === 'placed' ? '✅ Scommessa piazzata!' : 
                 placedBets[vb.id] === 'error' ? '❌ Errore' : 
                 '⚡ PIAZZA SCOMMESSA (€50)'}
              </button>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', color: '#64748b' }}>
            Nessuna anomalia statistica rilevata al momento. L'intelligenza artificiale sta analizzando le quote...
          </div>
        )}
      </div>
    </div>
  );

  const generateAiIdea = async () => {
    setAiLoading(true);
    try {
      const payload = { gemini_key: apiKeys.gemini_key || savedKeys.GEMINI_KEY || "" };
      const res = await fetch('/api/ai/generate-idea', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(data.topic) {
        setAiIdea(data);
      } else {
        const errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : (data.detail || "Errore sconosciuto");
        alert("Errore API: " + errorMsg);
      }
    } catch(e) {
      alert("Errore di rete o server non raggiungibile: " + e.message);
    }
    setAiLoading(false);
  };

  const handleVideoUpload = async (e) => {
    if(!e.target.files[0] || !aiIdea) return;
    setUploadingVideo(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    formData.append('topic', aiIdea.topic);
    formData.append('prompt', aiIdea.prompt);
    formData.append('description', aiIdea.description || "");
    formData.append('hashtags', aiIdea.hashtags || "");
    
    try {
      const res = await fetch('/api/ai/upload-video', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      if(data.status === 'success') {
        setAiIdea(null);
        alert('Video caricato con successo! Aureo lo distribuirà presto.');
      } else {
        alert(data.detail || "Errore upload");
      }
    } catch(e) {
      alert("Errore caricamento video.");
    }
    setUploadingVideo(false);
  };

  const handleCopyPrompt = () => {
    if (!aiIdea?.prompt) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(aiIdea.prompt);
      alert("Prompt copiato!");
    } else {
      // Fallback per HTTP non sicuro
      const textArea = document.createElement("textarea");
      textArea.value = aiIdea.prompt;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Prompt copiato!");
      } catch (err) {
        alert("Errore copia, fallo manualmente.");
      }
      document.body.removeChild(textArea);
    }
  };

  const renderAIContentView = () => (
    <div className="module-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>AI Content Spammer 🤖🔥</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Ti diamo l'idea, tu crei il video, Aureo lo spamma ovunque!</div>
        </div>
        <button 
          className={`btn ${status.modules?.ai_content ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('ai_content', status.modules?.ai_content)}
        >
          {status.modules?.ai_content ? 'FERMA DISTRIBUZIONE (PAUSA CODA)' : 'AVVIA DISTRIBUZIONE (ELABORA CODA)'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>1. Generatore di Argomenti</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Lascia che l'algoritmo scelga l'argomento più caldo per il tuo prossimo video.</p>
            <button 
              onClick={generateAiIdea}
              disabled={aiLoading}
              style={{ background: '#a855f7', color: '#fff', width: '100%', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: aiLoading ? 0.7 : 1 }}
            >
              {aiLoading ? '💡 Generazione in corso...' : '💡 Genera Idea Virale'}
            </button>
            {aiIdea && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#000', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <h4 style={{ color: '#a855f7', margin: '0 0 0.5rem 0' }}>Titolo: {aiIdea.topic}</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>SCRIPT DA LEGGERE:</span>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: '0.2rem 0', fontStyle: 'italic' }}>{aiIdea.script}</p>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>PROMPT VEO / SORA:</span>
                    <button onClick={handleCopyPrompt} style={{ background: 'transparent', border: '1px solid #a855f7', color: '#a855f7', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>Copia</button>
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: '0.2rem 0', fontFamily: 'monospace' }}>{aiIdea.prompt}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', opacity: aiIdea ? 1 : 0.5, pointerEvents: aiIdea ? 'auto' : 'none' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>2. Carica Video Generato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Genera il video gratuitamente su Veo incollando il prompt, scarica l'MP4 e caricalo qui.</p>
            <input type="file" id="video-upload" accept="video/mp4" style={{ display: 'none' }} onChange={handleVideoUpload} />
            <button 
              onClick={() => document.getElementById('video-upload').click()}
              disabled={uploadingVideo}
              style={{ background: '#10b981', color: '#000', width: '100%', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: uploadingVideo ? 0.7 : 1 }}
            >
              {uploadingVideo ? '⏳ Caricamento in coda...' : '📤 Carica MP4'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>Logs di Distribuzione</h4>
            {status.ai_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("✅") || l.includes("💰") ? '#10b981' : l.includes("Upload") ? '#f59e0b' : '#c084fc' }}>{l}</div>
            ))}
            {(!status.ai_logs || status.ai_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di video in coda...</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#e2e8f0', margin: 0 }}>Coda e Pubblicazioni</h3>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                Totale Generato (Oggi): +${Number(status.ai_videos?.reduce((acc, v) => acc + (v.earnings || 0), 0) || 0).toFixed(2)}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {status.ai_videos?.map(video => (
                <div key={video.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', padding: '1rem', gap: '1rem' }}>
                    <img src={video.thumbnail} alt="thumb" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>{video.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>👀 {video.views?.toLocaleString()} views</div>
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>+${video.earnings?.toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pubblicato {video.timestamp}</span>
                    <span style={{ color: '#a855f7' }}>TikTok / Shorts</span>
                  </div>
                </div>
              ))}
            </div>
            {(!status.ai_videos || status.ai_videos.length === 0) && (
              <div style={{ gridColumn: '1 / -1', padding: '3rem', margin: '1rem 0', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                Nessun video generato.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderComingSoon = (title, mod_id, description) => (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
      <h2>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>{description}</p>
      
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

  
  if (!isAuthenticated) {
    return (
      <div className="omni-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', width: '400px', padding: '3rem 2rem' }}>
          <img src="/aureo-logo.jpg" alt="AUREO" style={{ maxWidth: '100%', maxHeight: '140px', marginBottom: '1.5rem', objectFit: 'contain' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Ponte di Comando Autenticato</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="Inserisci Master Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            {loginError && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>ACCEDI ALLA DASHBOARD</button>
          </form>
          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
            🔒 Protetto da Crittografia<br/>
            {/* TODO: In futuro aggiungere supporto per Authenticator App (MFA) come richiesto dall'utente */}
          </div>
        </div>
      </div>
    );
  }

  return (
  <ErrorBoundary>
    <div className="omni-app">
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <img src="/aureo-icon.png" alt="Aureo Icon" style={{ height: '36px', objectFit: 'contain' }} />
            <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #d4af37, #f3e5ab)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '2px' }}>
              AUREO
            </h1>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.5rem', letterSpacing: '1px', textAlign: 'center' }}>CRYPTO & INVESTMENT TRADING</div>
        </div>
        
        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="menu-icon">📊</span> Dashboard
          </div>
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Stock Market
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
            <span className="menu-icon">⛓️</span> DeFi Arbitrage
            {status.modules?.crypto_arb && <div className="active-dot"></div>}
          </div>
          {/* <div className={`menu-item ${activeTab === 'sports_arb' ? 'active' : ''}`} onClick={() => setActiveTab('sports_arb')}>
            <span className="menu-icon">⚽</span> Sports SureBets
            {status.modules?.sports_arb && <div className="active-dot"></div>}
          </div> */}
          {/* <div className={`menu-item ${activeTab === 'value_bets' ? 'active' : ''}`} onClick={() => setActiveTab('value_bets')}>
            <span className="menu-icon">🤖</span> AI Sentiment Radar
            {status.modules?.ai_sports_sentiment && <div className="active-dot"></div>}
          </div> */}
          {/* <div className={`menu-item ${activeTab === 'ai_content' ? 'active' : ''}`} onClick={() => setActiveTab('ai_content')}>
            <span className="menu-icon">📱</span> AI Content Creator
            {status.modules?.ai_content && <div className="active-dot"></div>}
          </div> */}
          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="menu-icon">🔐</span> Security & API
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
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'settings' && renderSettingsView()}
        {activeTab === 'trading' && renderTradingView()}
        {activeTab === 'crypto_arb' && renderArbitrageView()}
        {activeTab === 'sports_arb' && renderSportsArbitrageView()}
        {activeTab === 'value_bets' && renderValueBetsView()}
        {activeTab === 'ai_content' && renderAIContentView()}
        {activeTab === 'saas' && (
           <div className="module-content" style={{ padding: '2rem' }}>
             <h2>Gestione SaaS & Clienti</h2>
             <p style={{ color: 'var(--text-secondary)' }}>Da qui potrai generare i link Stripe e gestire gli utenti paganti che si iscrivono al tuo ecosistema.</p>
           </div>
        )}
      </div>
    </div>
  </ErrorBoundary>
  );
}

export default OmniApp;
