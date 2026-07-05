import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import heroAsset from './assets/hero.png';
const AUTH_TOKEN_KEY = 'omni_auth_token';
const AUTH_TIME_KEY = 'omni_auth_time';
const DEMO_MODE_KEY = 'omni_demo_mode';
const BILLING_ENABLED = true;
const TAB_TITLES = {
  home: 'Dashboard',
  trading: 'Stock Market',
  crypto_arb: 'DeFi Arbitrage',
  sports_arb: 'Sports SureBets',
  value_bets: 'AI Sentiment',
  ai_content: 'AI Content',
  settings: 'Security & API',
  saas: 'SaaS & Billing',
  guide: '📖 Guida Setup',
};

const DEMO_BILLING_OVERVIEW = {
  metrics: {
    active_customers: 3,
    trialing_customers: 2,
    monthly_recurring_revenue: 777,
    annual_run_rate: 9324,
    leads_count: 6,
    collection_rate: 75,
  },
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price_monthly: 79,
      currency: 'EUR',
      description: 'Per trader indipendenti che vogliono dashboard e demo operativa.',
      features: ['Dashboard live', 'Demo mode', '1 workspace', 'Supporto email'],
      modules: ['dashboard', 'trading'],
      checkout_url: 'https://buy.stripe.com/test_starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      price_monthly: 199,
      currency: 'EUR',
      description: 'Per utenti che vogliono automazioni, segnali e moduli avanzati.',
      features: ['Tutti i moduli core', 'Alert operativi', '3 workspace', 'Priority support'],
      modules: ['dashboard', 'trading', 'defi', 'sentiment'],
      checkout_url: 'https://buy.stripe.com/test_pro',
    },
    {
      id: 'elite',
      name: 'Elite',
      price_monthly: 499,
      currency: 'EUR',
      description: 'Per desk, consulenti e clienti ad alto valore con onboarding guidato.',
      features: ['White-glove onboarding', 'Utenti multipli', 'Billing priority', 'Canale dedicato'],
      modules: ['dashboard', 'trading', 'defi', 'sentiment', 'ai_content', 'billing'],
      checkout_url: 'https://buy.stripe.com/test_elite',
    },
  ],
  customers: [
    { id: 'cus_demo_alpha', company: 'Alpha Quant Studio', contact_name: 'Marco Rossi', email: 'marco@alphaquant.studio', plan_id: 'pro', status: 'active', seats: 3, monthly_amount: 199, next_billing_at: '2026-07-12' },
    { id: 'cus_demo_beta', company: 'Beta Capital Lab', contact_name: 'Giulia Bianchi', email: 'giulia@betacapitallab.com', plan_id: 'starter', status: 'trialing', seats: 1, monthly_amount: 79, next_billing_at: '2026-07-08' },
  ],
  leads: [
    { id: 'lead_demo_1', company: 'Omega Signals', contact_name: 'Luca Verdi', email: 'luca@omegasignals.io', plan_id: 'elite', status: 'lead', created_at: '2026-07-02' },
  ],
  recent_activity: [
    { id: 'act_1', user_email: 'marco@alphaquant.studio', amount: 99, currency: 'USDT', txid: 'T...X8Y9', status: 'verified' },
    { id: 'act_2', user_email: 'giulia@betacapitallab.com', amount: 99, currency: 'USDT', txid: 'T...J3K4', status: 'pending' },
  ],
  settings: { trial_days: 7, currency: 'EUR' },
};

const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';
const isDemoSession = () => localStorage.getItem(DEMO_MODE_KEY) === '1';

const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TIME_KEY);
  localStorage.removeItem(DEMO_MODE_KEY);
  localStorage.removeItem('USER_ROLE');
  localStorage.removeItem('USER_STATUS');
};

const authFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (!token && isDemoSession()) {
    return new Response(JSON.stringify({ detail: 'Demo mode attiva: azione live non disponibile' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omni-auth-expired'));
    }
  }
  return response;
};

const base64urlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const base64urlToBuffer = (value) => base64urlToBytes(value).buffer;

const bufferToBase64url = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const HighRiskPnLSparkline = ({ history = [] }) => {
  const data = Array.isArray(history)
    ? history.map((x, i) => ({
        idx: i,
        pnl: Number(x.pnl ?? x.pnl_pct ?? 0),
      }))
    : [];

  if (!data.length) {
    return <span style={{ opacity: 0.45, fontSize: 11 }}>—</span>;
  }

  const last = data[data.length - 1]?.pnl ?? 0;
  const stroke = last >= 0 ? '#10b981' : '#ef4444';

  return (
    <div style={{ width: 90, height: 34 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)}%`, 'P&L']}
            labelFormatter={() => ''}
            contentStyle={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 8,
              fontSize: 11,
              color: '#fff',
            }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};



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

const RiskStatus = () => {
  const [risk, setRisk] = useState(null);
  
  useEffect(() => {
    const fetchRisk = () => authFetch('/api/risk/status').then(r => r.json()).then(setRisk).catch(e => console.error(e));
    fetchRisk();
    const interval = setInterval(fetchRisk, 5000);
    return () => clearInterval(interval);
  }, []);
  
  if (!risk || !risk.status) return <div className="card col-span-12" style={{ padding: '2rem', textAlign: 'center', color: '#f59e0b' }}>Caricamento Risk Manager (o Backend Offline)...</div>;
  
  const statusColors = {
    green: '#10B981',
    yellow: '#F59E0B', 
    red: '#EF4444',
    black: '#000000'
  };
  
  return (
    <div className="card col-span-6" style={{ border: `2px solid ${statusColors[risk.status] || '#555'}` }}>
      <div className="card-title">🛡️ Risk Manager</div>
      <div style={{color: statusColors[risk.status] || '#fff', fontSize: '1.5rem', fontWeight: 'bold'}}>
        {risk.status.toUpperCase()}
      </div>
      <div style={{ opacity: 0.8, marginTop: 4 }}>{risk.reason}</div>
      <div style={{marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
        <div>Equity: ${risk.equity}</div>
        <div>Daily P&L: {risk.daily_pnl_pct}%</div>
        <div>Drawdown: {risk.max_drawdown_pct}%</div>
        <div>Posizioni aperte: {risk.open_positions}</div>
      </div>
      {risk.status === 'black' && (
        <button 
          onClick={() => authFetch('/api/risk/emergency-stop', {method: 'POST'})}
          style={{ background: '#EF4444', color: 'white', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', width: '100%', cursor: 'pointer' }}
        >
          🛑 EMERGENCY STOP
        </button>
      )}
    </div>
  );
};

const CapitalPhase = () => {
  const [capital, setCapital] = useState(null);
  
  useEffect(() => {
    const fetchCap = () => authFetch('/api/capital/status').then(r => r.json()).then(setCapital).catch(e => console.error(e));
    fetchCap();
    const interval = setInterval(fetchCap, 5000);
    return () => clearInterval(interval);
  }, []);
  
  if (!capital || !capital.mode) return <div className="card col-span-12" style={{ padding: '2rem', textAlign: 'center', color: '#f59e0b' }}>Caricamento Capital Manager (o Backend Offline)...</div>;
  
  return (
    <div className="card col-span-6">
      <div className="card-title">💰 Gestione Capitale</div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>Modalità: <strong style={{ color: '#F5A623' }}>{capital.mode.toUpperCase()}</strong></div>
        <div>Capitale: €{capital.current_capital}</div>
      </div>
      <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>Max per trade: {capital.trade_limit_pct}%</div>
      
      <div style={{marginTop: '1rem'}}>
        <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}>Checklist per avanzare:</div>
        {capital.next_checklist && Object.entries(capital.next_checklist).map(([key, val]) => (
          <div key={key} style={{
            display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem',
            background: val.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            borderRadius: '6px', marginBottom: '0.4rem', fontSize: 12
          }}>
            <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}: {val.current}/{val.required}</span>
            <span>{val.ok ? '✅' : '❌'}</span>
          </div>
        ))}
      </div>
      
      {capital.can_advance && (
        <button 
          onClick={() => authFetch('/api/capital/advance', {method: 'POST'})}
          style={{ background: '#10B981', color: 'white', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', width: '100%', cursor: 'pointer' }}
        >
          🚀 AVANZA FASE
        </button>
      )}
    </div>
  );
};

const OnboardingModal = ({ onClose, onGoToSettings }) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#1a1f2e', padding: '2.5rem', borderRadius: '16px',
        width: '90%', maxWidth: '600px', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent',
          border: 'none', color: '#64748b', fontSize: '1.5rem', cursor: 'pointer'
        }}>×</button>

        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Benvenuto nel tuo Bot Personale!
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Prima di attivare l'intelligenza artificiale e iniziare a fare trading, devi collegare i tuoi account. Non preoccuparti, i tuoi fondi restano sempre al sicuro sui tuoi exchange e noi operiamo tramite chiavi API dedicate.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Alpaca */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fcd34d' }}>1. Trading Azionario (Alpaca)</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Alpaca è il broker senza commissioni utilizzato per l'azionario USA. <br/>
              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida:</strong> Registrati, conferma l'email e accedi. Clicca su "View API Keys" sulla destra della dashboard per generare la Key ID e la Secret Key.</span>
            </p>
            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#fcd34d', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Apri un account Alpaca ↗</a>
          </div>

          {/* Binance/Kraken */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#f59e0b' }}>2. Trading Crypto (Binance o Kraken)</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Per il trading ad alta frequenza sulle crypto, suggeriamo Binance o Kraken.<br/>
              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida Binance:</strong> Profilo {'>'} API Management {'>'} Create API. <br/>
              <strong>Guida Kraken:</strong> Profilo {'>'} Sicurezza {'>'} API {'>'} Aggiungi chiave. Attendi 24h se l'account è nuovo.</span>
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="https://www.binance.com/" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', background: '#f59e0b', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
              }}>Binance ↗</a>
              <a href="https://www.kraken.com/" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', background: '#5841D8', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
              }}>Kraken ↗</a>
            </div>
          </div>

          {/* Groq */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#a78bfa' }}>3. Intelligenza Artificiale (Groq)</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Il motore AI alla base delle decisioni di trading ultrarapide.<br/>
              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida:</strong> Accedi alla console di Groq, vai su "API Keys" nel menu a sinistra e clicca su "Create API Key". Copiala sùbito perché non potrai visualizzarla di nuovo.</span>
            </p>
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#a78bfa', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
            }}>Ottieni API Key Groq ↗</a>
          </div>
        </div>

        <button onClick={onGoToSettings} style={{
          width: '100%', padding: '1rem', marginTop: '2rem', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
        }}>
          Vai alle Impostazioni per inserire le chiavi
        </button>
      </div>
    </div>
  );
};

function OmniApp() {
  const [status, setStatus] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('USDT');
  const [txid, setTxid] = useState('');
  
  const [numValueBets, setNumValueBets] = useState(9);
  const [placedBets, setPlacedBets] = useState({});
  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', binance_key:'', binance_secret:'', kraken_key:'', kraken_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:''});
  const [testResults, setTestResults] = useState({});
  const [savedKeys, setSavedKeys] = useState({});
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [aiIdea, setAiIdea] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [billingOverview, setBillingOverview] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [billingLead, setBillingLead] = useState({ company: '', contact_name: '', email: '', plan_id: 'pro', seats: 1 });
  const [userIsPaid, setUserIsPaid] = useState(false);
  
  // AI Investment Hub state
  const [aiBudget, setAiBudget] = useState(500);
  const [aiProposals, setAiProposals] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");

  // High Risk Quick Scalping state
  const [tradeSize, setTradeSize] = useState(100);
  const [tradeResult, setTradeResult] = useState(null);
  const [aiModal, setAiModal] = useState(null); // null | { symbol, price, volatility, change_24h, loading, result, error }

  // Manual Stock Trading state
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualAmount, setManualAmount] = useState(100);
  const [manualQuote, setManualQuote] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  const handleCryptoSubmit = async () => {
    if (!txid) return alert('Inserisci il TXID');
    try {
      const res = await authFetch('/api/billing/submit-txid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid, amount: 99, currency: selectedCrypto })
      });
      const data = await res.json();
      setBillingMessage(data.message);
    } catch(e) {
      setBillingMessage('Errore di rete');
    }
  };

  const renderCryptoPaywall = () => (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e2e8f0' }}>🔐 Account in attesa di sblocco</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '600px' }}>
          Il tuo account è in modalità Demo. Per sbloccare tutte le funzionalità operative e il Live Trading, è necessario completare il pagamento.
        </p>
        
        <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'left', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💳</span> Effettua il Pagamento
          </h3>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Seleziona la criptovaluta, invia l'importo all'indirizzo indicato e inserisci qui il Transaction ID (TXID) per la verifica manuale.
          </p>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Metodo di Pagamento</label>
            <select value={selectedCrypto} onChange={(e) => setSelectedCrypto(e.target.value)} style={{ padding: '0.8rem', width: '100%' }}>
              <option value="USDT">USDT (TRC20)</option>
              <option value="USDC">USDC (ERC20)</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="SOL">Solana (SOL)</option>
            </select>
          </div>

          <div style={{ background: '#111', padding: '1rem', borderRadius: '8px', border: '1px solid #333', marginBottom: '1.5rem', wordBreak: 'break-all', fontSize: '0.9rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Indirizzo di Deposito {selectedCrypto}</div>
            <strong style={{ color: '#e2e8f0', userSelect: 'all' }}>
              {selectedCrypto === 'BTC' ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 
               selectedCrypto === 'ETH' || selectedCrypto === 'USDC' ? '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' :
               selectedCrypto === 'SOL' ? 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH' :
               'TX9bF1BWeYdG4N6N1eR6fB8B5L6M7P8Q9R'}
            </strong>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Transaction ID (TXID)</label>
            <input 
              type="text" 
              placeholder="Es. f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              style={{ width: '100%', padding: '0.8rem' }}
            />
          </div>

          <button className="btn btn-start" onClick={handleCryptoSubmit} style={{ width: '100%', padding: '1rem' }}>
            Invia per Verifica
          </button>
          
          {billingMessage && (
            <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem' }}>
              {billingMessage}
            </div>
          )}
        </div>
      </div>
  );

  const handleQuote = async () => {
    if (!manualSymbol) return;
    setManualLoading(true);
    setManualMessage("");
    try {
      const res = await authFetch(`/api/stock/quote/${manualSymbol}`);
      const data = await res.json();
      if (data.error) {
        setManualMessage(data.error);
        setManualQuote(null);
      } else {
        setManualQuote(data);
      }
    } catch(err) {
      setManualMessage("Errore di connessione");
    }
    setManualLoading(false);
  };

  const handleManualTrade = async (side) => {
    if (!manualSymbol || manualAmount <= 0) return;
    setManualLoading(true);
    try {
      const res = await authFetch('/api/stock/trade/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: manualSymbol, side, amount: manualAmount })
      });
      const data = await res.json();
      if (data.error) {
        setManualMessage(`Errore: ${data.error}`);
      } else {
        setManualMessage(data.message);
        if (side === 'buy') setManualQuote(null);
      }
    } catch(err) {
      setManualMessage("Errore esecuzione ordine");
    }
    setManualLoading(false);
  };

  const openAiSignal = async (asset) => {
    setAiModal({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h, loading: true, result: null, error: null });
    try {
      const res = await authFetch('/api/high-risk/ai-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h })
      });
      const data = await res.json();
      if (data.error) {
        setAiModal(prev => ({ ...prev, loading: false, error: data.error }));
      } else {
        setAiModal(prev => ({ ...prev, loading: false, result: data }));
      }
    } catch (e) {
      setAiModal(prev => ({ ...prev, loading: false, error: 'Errore di rete: ' + e.message }));
    }
  };

  const quickTrade = async (symbol, side, amount) => {
    setTradeResult(null);
    try {
      const res = await authFetch('/api/high-risk/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, amount })
      });
      const data = await res.json();
      setTradeResult(data);
      // Aggiorna il saldo virtuale nel context locale
      if (!data.error && data.virtual_cash !== undefined) {
        setStatus(prev => ({ ...prev, cash: data.virtual_cash }));
      }
      // Cancella il messaggio dopo 5 secondi
      setTimeout(() => setTradeResult(null), 5000);
    } catch (e) {
      setTradeResult({ error: 'Errore di rete: ' + e.message });
    }
  };

  const checkAuthMemory = () => {
    const authTime = localStorage.getItem(AUTH_TIME_KEY);
    const authToken = getAuthToken();
    if (!authToken) {
      clearAuthSession();
      return false;
    }
    if (authTime) {
      const elapsed = Date.now() - parseInt(authTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) {
        return true;
      }
    }
    clearAuthSession();
    return false;
  };
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuthMemory());
  const [showLanding, setShowLanding] = useState(true);
  const [showLandingPlans, setShowLandingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const TOUR_STEPS = [
    {
      targetTab: 'home',
      title: 'Benvenuto in Aureo OS',
      text: 'Questa è la Dashboard Principale, la tua Control Room. Da qui hai una visione globale del tuo portafoglio, bilanciamento in tempo reale e metriche chiave.'
    },
    {
      targetTab: 'trading',
      title: 'Trading Manuale & AI',
      text: 'Qui puoi seguire i segnali operativi guidati dall\'Intelligenza Artificiale, analizzare i grafici e impostare operazioni sia manuali che ad alta frequenza.'
    },
    {
      targetTab: 'crypto_arb',
      title: 'Arbitraggio DeFi',
      text: 'Il modulo Arbitraggio analizza centinaia di pool di liquidità decentralizzate per farti capitalizzare gli spread in millisecondi.'
    },
    {
      targetTab: 'value_bets',
      title: 'AI Sentiment & Value Bets',
      text: 'L\'AI scandaglia news, tweet e flussi di mercato per prevedere i movimenti istituzionali e suggerirti scommesse di valore altissimo.'
    },
    {
      targetTab: 'settings',
      title: 'Sicurezza Totale',
      text: 'Aureo OS è un vero e proprio caveau. Nessuna password insicura: accesso biometrico Passkey e chiavi API crittografate end-to-end.'
    }
  ];

  const startTour = () => {
    setIsTourActive(true);
    setTourStep(0);
    setShowLanding(false);
    setIsDemoMode(true);
    setIsAuthenticated(true);
    setActiveTab(TOUR_STEPS[0].targetTab);
  };

  const nextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      setActiveTab(TOUR_STEPS[nextStep].targetTab);
    } else {
      endTour();
    }
  };

  const prevTourStep = () => {
    if (tourStep > 0) {
      const prevStep = tourStep - 1;
      setTourStep(prevStep);
      setActiveTab(TOUR_STEPS[prevStep].targetTab);
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setIsDemoMode(false);
    setIsAuthenticated(false);
    setShowLanding(true);
  };
  const [isDemoMode, setIsDemoMode] = useState(isDemoSession());

  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [userRole, setUserRole] = useState(localStorage.getItem('USER_ROLE') || 'user');
  const [userStatus, setUserStatus] = useState(localStorage.getItem('USER_STATUS') || 'active');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [lastStatusSync, setLastStatusSync] = useState(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState({ supported: false, configured: false, credentials_count: 0, credentials: [] });
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const activeTabLabel = TAB_TITLES[activeTab] || 'AUREO';
  const demoActionButtonProps = (disabled = false) => (
    isDemoMode
      ? { disabled: true, title: 'Non disponibile in demo mode' }
      : { disabled }
  );
  const demoActionStyle = isDemoMode ? { opacity: 0.5, cursor: 'not-allowed' } : {};
  const syncLabel = isBackendOnline
    ? (lastStatusSync ? `Live • ${lastStatusSync}` : 'Live')
    : 'Offline';

  useEffect(() => {
    if (!BILLING_ENABLED && activeTab === 'saas') {
      setActiveTab('home');
    }
  }, [activeTab]);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
    setPasskeySupported(supported);
  }, []);

  const enterDemoMode = () => {
    localStorage.setItem(DEMO_MODE_KEY, '1');
    setIsDemoMode(true);
    setIsAuthenticated(true);
    setLoginError('');
    setPassword('');
    setActiveTab('home');
  };

  useEffect(() => {
    const handleExpired = () => {
      if (isDemoSession()) {
        return;
      }
      setIsAuthenticated(false);
      setLoginError('Sessione scaduta. Fai di nuovo login');
    };
    window.addEventListener('omni-auth-expired', handleExpired);
    return () => window.removeEventListener('omni-auth-expired', handleExpired);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status?t=' + Date.now(), {
          headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
        });
        const data = await res.json();
        if (!data.error) {
          setStatus(data);
          setIsBackendOnline(true);
          setLastStatusSync(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
          if (!selectedSymbol && data.symbols && data.symbols.length > 0) {
            setSelectedSymbol(data.symbols[0]);
          }
        }
      } catch (err) {
        setIsBackendOnline(false);
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

  const completeAuthenticatedSession = (token, role = 'user', status = 'active') => {
    setIsAuthenticated(true);
    const demo = (status === 'pending');
    setIsDemoMode(demo);
    setUserRole(role);
    setUserStatus(status);
    if (demo) {
      localStorage.setItem(DEMO_MODE_KEY, '1');
    } else {
      localStorage.removeItem(DEMO_MODE_KEY);
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_TIME_KEY, Date.now().toString());
    localStorage.setItem('USER_ROLE', role);
    localStorage.setItem('USER_STATUS', status);
    setLoginError('');
    setPasskeyMessage('');
    setActiveTab('home');
    // Fetch payment status and check onboarding for user (non-blocking)
    setTimeout(async () => {
      try {
        const res = await authFetch('/api/user/me');
        if (res.ok) {
          const data = await res.json();
          setUserIsPaid(data.is_paid || data.role === 'admin');
        }
        
        if (role !== 'admin' && !demo) {
          const keysRes = await authFetch('/api/keys');
          if (keysRes.ok) {
            const keysData = await keysRes.json();
            if (!keysData.ALPACA_KEY && !keysData.BINANCE_KEY) {
              setShowOnboarding(true);
            }
          }
        }
      } catch(e) {}
    }, 500);
  };

  const normalizeCreationOptions = (publicKey) => ({
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64urlToBuffer(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map((item) => ({
      ...item,
      id: base64urlToBuffer(item.id),
    })),
  });

  const normalizeRequestOptions = (publicKey) => ({
    ...publicKey,
    challenge: base64urlToBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map((item) => ({
      ...item,
      id: base64urlToBuffer(item.id),
    })),
  });

  const fetchPasskeyStatus = async () => {
    if (userRole !== 'admin') return;
    try {
      const res = await authFetch('/api/passkeys/status?t=' + Date.now());
      const data = await res.json();
      if (res.ok) {
        setPasskeyStatus({ ...data, supported: passkeySupported });
      }
    } catch(e) {}
  };


  const openPricingSection = () => {
    setShowLandingPlans(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const element = document.getElementById('landing-pricing');
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const continueWithPlan = (planId) => {
    setSelectedPlanId(planId);
    setBillingLead((prev) => ({ ...prev, plan_id: planId }));
    setLoginError('');
    setPassword('');
    setEmail('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      if (isRegistering) {
        const res = await fetch('/api/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          // Auto-login after successful registration
          const loginRes = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            completeAuthenticatedSession(loginData.token, loginData.role, loginData.user_status);
            // Show paywall immediately to prompt payment
            setShowPaymentModal(true);
          } else {
            setLoginError('Registrazione ok, ma login automatico fallito. Riprova.');
          }
        } else {
          setLoginError(data.detail || 'Errore durante la registrazione');
        }
      } else {
        // Modalità Login (se email è vuoto entra come admin)
        const payload = email ? { email, password } : { password };
        const res = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          completeAuthenticatedSession(data.token, data.role || 'user', data.user_status || 'active');
        } else {
          clearAuthSession();
          setIsAuthenticated(false);
          setLoginError(data.detail || data.message || 'Accesso negato');
        }
      }
    } catch (err) {
      clearAuthSession();
      setIsAuthenticated(false);
      setLoginError('Errore di connessione al server');
    }
  };

  const handlePasskeyLogin = async () => {
    if (!passkeySupported) {
      setLoginError('Questo dispositivo non supporta il login biometrico via browser');
      return;
    }
    setPasskeyBusy(true);
    setLoginError('');
    try {
      const optionsRes = await fetch('/api/passkeys/auth/options', { method: 'POST' });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setLoginError(optionsData.detail || 'Biometria non disponibile');
        setPasskeyBusy(false);
        return;
      }

      const credential = await navigator.credentials.get({
        publicKey: normalizeRequestOptions(optionsData.publicKey),
      });
      if (!credential) {
        setLoginError('Accesso biometrico annullato');
        setPasskeyBusy(false);
        return;
      }

      const verifyRes = await fetch('/api/passkeys/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: optionsData.request_id,
          id: credential.id,
          raw_id: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            client_data_json: bufferToBase64url(credential.response.clientDataJSON),
            authenticator_data: bufferToBase64url(credential.response.authenticatorData),
            signature: bufferToBase64url(credential.response.signature),
            user_handle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : '',
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.status === 'success') {
        completeAuthenticatedSession(verifyData.token);
      } else {
        clearAuthSession();
        setIsAuthenticated(false);
        setLoginError(verifyData.detail || 'Accesso biometrico non riuscito');
      }
    } catch (err) {
      setLoginError(err?.message || 'Errore di connessione al login biometrico');
    }
    setPasskeyBusy(false);
  };

  const registerCurrentDevicePasskey = async () => {
    if (isDemoMode) {
      setPasskeyMessage('Demo mode: registrazione biometrica disabilitata');
      return;
    }
    if (!passkeySupported) {
      setPasskeyMessage('Questo dispositivo non supporta Passkeys');
      return;
    }
    setPasskeyBusy(true);
    setPasskeyMessage('');
    try {
      const optionsRes = await authFetch('/api/passkeys/register/options', { method: 'POST' });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setPasskeyMessage(optionsData.detail || 'Impossibile avviare la registrazione biometrica');
        setPasskeyBusy(false);
        return;
      }

      const credential = await navigator.credentials.create({
        publicKey: normalizeCreationOptions(optionsData.publicKey),
      });
      if (!credential) {
        setPasskeyMessage('Registrazione biometrica annullata');
        setPasskeyBusy(false);
        return;
      }

      const verifyRes = await authFetch('/api/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: optionsData.request_id,
          id: credential.id,
          raw_id: bufferToBase64url(credential.rawId),
          type: credential.type,
          label: navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.platform || 'Questo dispositivo',
          response: {
            client_data_json: bufferToBase64url(credential.response.clientDataJSON),
            attestation_object: bufferToBase64url(credential.response.attestationObject),
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        setPasskeyMessage('Biometria attivata su questo dispositivo');
        setPasskeyStatus((prev) => ({
          ...prev,
          configured: true,
          credentials_count: verifyData.credentials_count || 1,
          credentials: verifyData.credential ? [...(prev.credentials || []).filter((item) => item.id !== verifyData.credential.id), verifyData.credential] : prev.credentials,
        }));
      } else {
        setPasskeyMessage(verifyData.detail || 'Registrazione biometrica non riuscita');
      }
    } catch (err) {
      setPasskeyMessage(err?.message || 'Errore durante l’attivazione biometrica');
    }
    setPasskeyBusy(false);
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      clearAuthSession();
      window.location.href = '/';
    }
  };

  const toggleModule = async (mod_id, isActive) => {
    setStatus(prev => ({
      ...prev,
      modules: { ...(prev.modules || {}), [mod_id]: !isActive }
    }));
    try {
      await authFetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: mod_id, active: !isActive })
      });
      // Il polling da 2 secondi rileverà automaticamente il nuovo stato
    } catch (err) {
      console.error(err);
    }
  };

  const generateAiProposals = async (strategy = 'balanced') => {
    setIsAiLoading(true);
    setExecutionMessage("");
    setAiProposals([]);
    try {
      const res = await fetch('/api/ai-invest/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: Number(aiBudget), strategy })
      });
      const data = await res.json();
      if (data.proposals) {
        setAiProposals(data.proposals);
      } else {
        setExecutionMessage(data.detail || "Errore sconosciuto");
      }
    } catch (err) {
      console.error(err);
      setExecutionMessage("Errore di connessione al server.");
    }
    setIsAiLoading(false);
  };

  const cancelAiInvestment = async (index, symbol, platform) => {
    if(!window.confirm(`Vuoi davvero annullare l'ordine su ${symbol}?`)) return;
    try {
      const res = await authFetch('/api/ai-invest/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, symbol, platform })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Forza refresh stato
        fetch('/api/status', {
          headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
        }).then(r => r.json()).then(d => { if(!d.error) setStatus(d); });
      } else {
        alert(data.detail || 'Errore durante la cancellazione');
      }
    } catch (e) {
      alert('Errore di rete');
    }
  };

  const executeAiProposal = async (proposal) => {
    setExecutionMessage(`Esecuzione in corso per ${proposal.symbol}...`);
    try {
      const res = await authFetch('/api/ai-invest/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: proposal.symbol,
          asset_type: proposal.asset_type,
          amount_usd: Number(aiBudget)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setExecutionMessage(`✅ ${data.message}`);
        // Aggiorna lo stato del portafoglio forzando il refetch (sarà gestito dal polling)
      } else {
        setExecutionMessage(`❌ Errore: ${data.detail}`);
      }
    } catch (err) {
      console.error(err);
      setExecutionMessage("❌ Errore di rete durante l'esecuzione.");
    }
  };

  const placeBet = async (sb) => {
    if (placedBets[sb.id]) return; // già piazzata
    setPlacedBets(prev => ({ ...prev, [sb.id]: 'loading' }));
    try {
      const res = await authFetch('/api/place-bet', {
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
        const res = await authFetch('/api/reset', { method: 'POST' });
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
      const res = await authFetch('/api/test-connection', {
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
      const res = await authFetch('/api/keys', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(apiKeys)
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Errore sconosciuto dal server');
      }
      alert('Chiavi salvate con successo nel Vault Sicuro!');
      // Refetch keys immediately so dots appear
      const refetchRes = await authFetch('/api/keys');
      const data = await refetchRes.json();
      setSavedKeys(data);
    } catch(err) {
      alert('Errore durante il salvataggio: ' + err.message);
    }
  };

  
  useEffect(() => {
    if (activeTab === 'settings') {
      if (isDemoMode) {
        setSavedKeys({});
        return;
      }
      const fetchKeys = async () => {
        try {
          const res = await authFetch('/api/keys?t=' + Date.now());
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
            groq_key: data.GROQ_KEY || '',
            newsapi_key: data.NEWSAPI_KEY || ''
          }));
        } catch(err) {
          console.error("Error fetching keys", err);
          alert("Errore di rete durante il caricamento delle chiavi dal Vault.");
        }
      };
      fetchKeys();
    }
  }, [activeTab, isDemoMode]);

  useEffect(() => {
    if (activeTab !== 'saas') return;
    if (isDemoMode) {
      setBillingOverview(DEMO_BILLING_OVERVIEW);
      return;
    }
    const fetchBilling = async () => {
      setBillingLoading(true);
      try {
        const res = await authFetch('/api/saas/overview?t=' + Date.now());
        const data = await res.json();
        if (res.ok) {
          setBillingOverview(data);
        } else {
          setBillingMessage(data.detail || 'Errore caricamento billing');
        }
      } catch (err) {
        setBillingMessage('Errore di connessione area billing');
      }
      setBillingLoading(false);
    };
    fetchBilling();
  }, [activeTab, isDemoMode]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || activeTab !== 'settings') {
      return;
    }
    fetchPasskeyStatus();
  }, [activeTab, isAuthenticated, isDemoMode]);

  useEffect(() => {
    if (isAuthenticated && !isDemoMode && userRole !== 'admin') {
      const checkOnboarding = async () => {
        try {
          const res = await authFetch('/api/keys');
          if (res.ok) {
            const data = await res.json();
            if (!data.ALPACA_KEY && !data.BINANCE_KEY && !data.KRAKEN_KEY) {
              setShowOnboarding(true);
            }
          }
        } catch(e) {}
      };
      checkOnboarding();
    }
  }, [isAuthenticated, isDemoMode, userRole]);

  const copyCheckoutLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setBillingMessage('Link checkout copiato negli appunti');
    } catch {
      setBillingMessage('Copia non riuscita, copia il link manualmente');
    }
  };

  const createBillingLead = async () => {
    if (isDemoMode) {
      setBillingMessage('Demo mode: creazione lead disabilitata');
      return;
    }
    setBillingMessage('');
    setBillingLoading(true);
    try {
      const res = await authFetch('/api/saas/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingLead),
      });
      const data = await res.json();
      if (res.ok) {
        setBillingOverview(data.overview);
        setBillingLead({ company: '', contact_name: '', email: '', plan_id: billingLead.plan_id, seats: 1 });
        setBillingMessage('Lead creato con successo');
      } else {
        setBillingMessage(data.detail || 'Errore creazione lead');
      }
    } catch {
      setBillingMessage('Errore di rete durante la creazione del lead');
    }
    setBillingLoading(false);
  };

  const updateBillingStatus = async (recordId, statusValue) => {
    if (isDemoMode) {
      setBillingMessage('Demo mode: aggiornamento stato disabilitato');
      return;
    }
    setBillingLoading(true);
    try {
      const res = await authFetch(`/api/saas/customer/${recordId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillingOverview(data.overview);
        setBillingMessage(`Stato aggiornato a ${statusValue.toUpperCase()}`);
      } else {
        setBillingMessage(data.detail || 'Errore aggiornamento stato');
      }
    } catch {
      setBillingMessage('Errore di rete durante l’aggiornamento');
    }
    setBillingLoading(false);
  };

  const renderGuideView = () => {
    const platforms = [
      {
        id: 'alpaca',
        name: 'Alpaca',
        subtitle: 'Stock Trading USA (Paper & Live)',
        icon: '🦙',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.25)',
        url: 'https://alpaca.markets',
        keyPresent: savedKeys['ALPACA_KEY'],
        steps: [
          { n: 1, text: 'Vai su alpaca.markets e clicca "Create Account"' },
          { n: 2, text: 'Scegli Paper Trading (gratuito, nessun rischio reale)' },
          { n: 3, text: 'Nella dashboard, clicca "API Keys" in alto a destra' },
          { n: 4, text: 'Genera nuova API Key → copia "API Key ID" e "Secret Key"' },
          { n: 5, text: 'Torna su Aureo OS → Security → incolla in "Alpaca"' },
        ],
        note: 'Il Paper Trading è completamente gratuito e simula operazioni reali senza rischi.',
      },
      {
        id: 'binance',
        name: 'Binance',
        subtitle: 'Crypto Arbitrage',
        icon: '🟡',
        color: '#eab308',
        bg: 'rgba(234, 179, 8, 0.08)',
        border: 'rgba(234, 179, 8, 0.25)',
        url: 'https://www.binance.com',
        keyPresent: savedKeys['BINANCE_KEY'],
        steps: [
          { n: 1, text: 'Vai su binance.com → Registrati con email' },
          { n: 2, text: 'Completa la verifica identità (KYC) — richiede documento' },
          { n: 3, text: 'Profilo → Gestione API → Crea nuova API Key' },
          { n: 4, text: 'Permessi: abilita "Lettura" + "Trading Spot". Lascia DISABILITATO "Prelievi"' },
          { n: 5, text: 'Copia "API Key" e "Secret Key"' },
          { n: 6, text: 'Torna su Aureo OS → Security → incolla in "Binance"' },
        ],
        note: '⚠️ Non abilitare mai i permessi di prelievo sulle API Key per sicurezza.',
      },
      {
        id: 'kraken',
        name: 'Kraken',
        subtitle: 'Crypto Arbitrage (secondo exchange)',
        icon: '🦑',
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.08)',
        border: 'rgba(139, 92, 246, 0.25)',
        url: 'https://www.kraken.com',
        keyPresent: savedKeys['KRAKEN_KEY'],
        steps: [
          { n: 1, text: 'Vai su kraken.com → Registrati' },
          { n: 2, text: 'Completa la verifica base (email + telefono)' },
          { n: 3, text: 'Sicurezza → API Keys → Genera nuova chiave' },
          { n: 4, text: 'Permessi: seleziona "Query Funds" + "Create & Modify Orders"' },
          { n: 5, text: 'Copia "API Key" e "Private Key"' },
          { n: 6, text: 'Torna su Aureo OS → Security → incolla in "Kraken"' },
        ],
        note: 'Kraken è usato in combinazione con Binance per rilevare opportunità di arbitraggio.',
      },
      {
        id: 'groq',
        name: 'Groq AI',
        subtitle: 'Analisi AI & Sentiment (Gratuito)',
        icon: '🤖',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.25)',
        url: 'https://console.groq.com',
        keyPresent: savedKeys['GROQ_KEY'],
        steps: [
          { n: 1, text: 'Vai su console.groq.com → Sign Up (gratuito)' },
          { n: 2, text: 'Nella dashboard, clicca "API Keys" nel menu a sinistra' },
          { n: 3, text: 'Clicca "Create API Key" → dai un nome (es. "aureo")' },
          { n: 4, text: 'Copia la chiave generata (mostrata una sola volta)' },
          { n: 5, text: 'Torna su Aureo OS → Security → incolla in "Groq"' },
        ],
        note: 'Groq è completamente gratuito e alimenta le analisi AI Sentiment e le proposte di investimento.',
      },
    ];

    return (
      <div className="module-content">
        <div className="header" style={{ marginBottom: '2rem' }}>
          <h2>📖 Guida Setup – Come Configurare Aureo OS</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
            Segui questi passaggi per connettere i tuoi account ai mercati reali. Puoi configurare solo le piattaforme che vuoi usare.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
          {platforms.map(platform => (
            <div key={platform.id} className="card" style={{ border: `1px solid ${platform.border}`, background: platform.bg, padding: '1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{platform.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#e2e8f0' }}>{platform.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{platform.subtitle}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  {platform.keyPresent
                    ? <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }}>✓ API Configurata</span>
                    : <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}>✗ Non configurata</span>
                  }
                  <a href={platform.url} target="_blank" rel="noopener noreferrer" style={{ color: platform.color, fontSize: '0.8rem', textDecoration: 'none' }}>
                    🔗 Vai al sito →
                  </a>
                </div>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {platform.steps.map(step => (
                  <div key={step.n} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                    <span style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: platform.color, color: '#000', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      {step.n}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>{step.text}</span>
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
                💡 {platform.note}
              </div>

              {/* CTA */}
              <button
                className="btn btn-outline"
                onClick={() => setActiveTab('settings')}
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', borderColor: platform.color, color: platform.color }}
              >
                🔐 Vai a Security per inserire la chiave →
              </button>
            </div>
          ))}
        </div>

        {/* Bottom tip */}
        <div className="card" style={{ marginTop: '2rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '1.5rem' }}>
          <h3 style={{ color: '#10b981', marginBottom: '0.8rem' }}>✅ Ordine consigliato per iniziare</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { n: 1, icon: '🤖', name: 'Groq AI', desc: 'Prima cosa — gratuito e immediato' },
              { n: 2, icon: '🦙', name: 'Alpaca', desc: 'Paper trading gratuito — zero rischi' },
              { n: 3, icon: '🟡', name: 'Binance', desc: 'Crypto arb (richiede KYC)' },
              { n: 4, icon: '🦑', name: 'Kraken', desc: 'Secondo exchange per arb' },
            ].map(item => (
              <div key={item.n} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>Step {item.n}: {item.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsView = () => (
    <div className="module-content">
      <div className="header" style={{ marginBottom: '2rem' }}>
        <h2>🔐 Security & API Vault</h2>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Gestione chiavi crittografate per le connessioni ai mercati reali.</div>
      </div>

      {isDemoMode && (
        <div className="card demo-mode-card" style={{ marginBottom: '2rem' }}>
          <div className="card-title">Demo Mode</div>
          <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '0.6rem' }}>Vault in sola lettura</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            In demo puoi esplorare dashboard e moduli, ma test connessioni, chiavi API e azioni live restano bloccate.
          </div>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>Accesso biometrico</h3>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.45rem', lineHeight: 1.5 }}>
                Attiva Face ID, Touch ID o biometria del dispositivo come accesso rapido, mantenendo la password come backup.
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: passkeyStatus?.configured ? '#10b981' : 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                {passkeyStatus?.configured ? `✓ Attivo (${passkeyStatus.credentials_count} credenziali)` : 'Disattivato'}
              </span>
              <button className="btn btn-outline" onClick={registerCurrentDevicePasskey} disabled={!passkeySupported || passkeyBusy || isDemoMode}>
                {passkeyBusy ? 'Configurazione...' : 'Aggiungi dispositivo'}
              </button>
            </div>
          </div>
          {passkeyMessage && (
            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              {passkeyMessage}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Alpaca (Stock Market) {savedKeys['ALPACA_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('alpaca')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.alpaca_key} onChange={e => setApiKeys({...apiKeys, alpaca_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.alpaca_secret} onChange={e => setApiKeys({...apiKeys, alpaca_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['alpaca'] && <div style={{ color: testResults['alpaca'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['alpaca']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Binance (Crypto Arb) {savedKeys['BINANCE_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('binance')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.binance_key} onChange={e => setApiKeys({...apiKeys, binance_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.binance_secret} onChange={e => setApiKeys({...apiKeys, binance_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['binance'] && <div style={{ color: testResults['binance'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['binance']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Kraken (Crypto Arb) {savedKeys['KRAKEN_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('kraken')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.kraken_key} onChange={e => setApiKeys({...apiKeys, kraken_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.kraken_secret} onChange={e => setApiKeys({...apiKeys, kraken_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['kraken'] && <div style={{ color: testResults['kraken'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['kraken']}</div>}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Groq AI (Sentiment & Investments) {savedKeys['GROQ_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
          <button onClick={() => testConnection('groq')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="Groq API Key" value={apiKeys.groq_key} onChange={e => setApiKeys({...apiKeys, groq_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['groq'] && <div style={{ color: testResults['groq'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['groq']}</div>}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={saveKeys} className="btn btn-start" {...demoActionButtonProps()} style={{ padding: '1rem 3rem', fontSize: '1.1rem', ...demoActionStyle }}>Salva nel Vault Sicuro</button>
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
      <div className="module-content module-content--home">
        <div className="header module-page-header" style={{ marginBottom: '2rem' }}>
          <h2>Dashboard 📊</h2>
          <div className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Dashboard Aggregata delle Rendite Passive</div>
        </div>

        {status.alpaca_connected === false && (
          <div className="onboarding-banner" style={{ background: 'linear-gradient(90deg, #ef4444, #b91c1c)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>⚠️ Broker non collegato</h3>
              <p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca/Binance.</p>
            </div>
            <button onClick={() => setActiveTab('settings')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>Collega ora ➔</button>
          </div>
        )}

        {/* Big Number */}
        <div className="hero-summary" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center', marginBottom: '2rem' }}>
          <div className="hero-summary-label" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
          <div className="hero-summary-value" style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
            ${totalWorth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Pie Chart Asset Allocation */}
          <div className="card col-span-6">
            <h3 className="card-title">Asset Allocation</h3>
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
          <div className="card col-span-6">
            <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>🏆 Leaderboard Moduli</h3>
            
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
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spread</div>
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
    <div className="module-content module-content--trading">
      <div className="header module-page-header trading-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>ALGO-TRADING ENGINE</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: status.market_open ? '#10b981' : '#f59e0b' }}></div>
              Market {status.market_open ? 'Open' : 'Closed'}
            </span>
            {status.alpaca_info && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  background: status.alpaca_info.type === 'LIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                  color: status.alpaca_info.type === 'LIVE' ? '#10b981' : '#8b5cf6' 
                }}>
                  {status.alpaca_info.type}
                </span>
                <span>{status.alpaca_info.account_number} ({status.alpaca_info.status})</span>
              </span>
            )}
          </div>
        </div>
        <div className="trading-header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className={`btn ${status.modules?.trading ? 'btn-stop' : 'btn-start'}`}
              onClick={() => toggleModule('trading', status.modules?.trading)}
              {...demoActionButtonProps()}
              style={demoActionStyle}
            >
              {status.modules?.trading ? 'FERMA SCANNER' : 'AVVIA SCANNER AUTOMATICO'}
            </button>
            <button className="btn btn-stop" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', ...demoActionStyle }} onClick={handleReset} {...demoActionButtonProps()}>
              RESET SIMULAZIONE
            </button>
        </div>
      </div>


      {/* MANUAL TRADING TERMINAL */}
      <div className="card trading-manual-card" style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🎯</span> Terminale Azionario Manuale
        </h3>
        <div className="trading-manual-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Ticker (es. AAPL)"
            value={manualSymbol} 
            onChange={(e) => setManualSymbol(e.target.value.toUpperCase())} 
            className="trading-manual-input"
            style={{ width: '150px', padding: '0.8rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '1.1rem' }} 
          />
          <button className="btn" onClick={handleQuote} {...demoActionButtonProps(manualLoading || !manualSymbol)} style={{ padding: '0.8rem 1.5rem', background: 'rgba(255,255,255,0.1)', ...demoActionStyle }}>
            {manualLoading ? '⏳' : 'Cerca Prezzo'}
          </button>
          
          {manualQuote && (
            <div className="trading-quote-box" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>${manualQuote.price.toFixed(2)}</span>
              
              <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.2)' }}></div>
              
              <span style={{ color: 'var(--text-secondary)' }}>Importo ($)</span>
              <input 
                type="number" 
                value={manualAmount} 
                onChange={(e) => setManualAmount(Number(e.target.value))} 
                className="trading-amount-input"
                style={{ width: '100px', padding: '0.6rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff' }} 
              />
              <button className="btn btn-start" onClick={() => handleManualTrade('buy')} {...demoActionButtonProps(manualLoading || manualAmount <= 0)} style={{ padding: '0.6rem 1.5rem', ...demoActionStyle }}>
                COMPRA
              </button>
              <button className="btn btn-stop" onClick={() => handleManualTrade('sell')} {...demoActionButtonProps(manualLoading)} style={{ padding: '0.6rem 1.5rem', ...demoActionStyle }}>
                VENDI
              </button>
            </div>
          )}
        </div>
        {manualMessage && (
          <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', color: manualMessage.includes('Errore') ? '#ef4444' : '#10b981' }}>
            {manualMessage}
          </div>
        )}
      </div>

      {/* AI INVESTMENT HUB */}
      <div className="card trading-ai-card" style={{ marginTop: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div className="trading-ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 className="trading-ai-title" style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🧠</span> AI Guided Investment (One-Click)
            </h3>
            <div className="trading-ai-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Lascia che il nostro modello quantitativo scelga le opportunità migliori per il tuo budget.</div>
          </div>
          <div className="trading-ai-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="trading-ai-budget-label" style={{ color: 'var(--text-secondary)' }}>Budget ($)</span>
            <input 
              type="number" 
              value={aiBudget} 
              onChange={(e) => setAiBudget(e.target.value)} 
              className="trading-ai-budget-input"
              style={{ width: '120px', padding: '0.8rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '1.1rem' }} 
            />
            <button className="btn btn-start trading-ai-action" onClick={() => generateAiProposals('balanced')} {...demoActionButtonProps(isAiLoading)} style={{ padding: '0.8rem 1.5rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8', ...demoActionStyle }}>
              {isAiLoading ? 'Analisi...' : 'Diversificate'}
            </button>
            <button className="btn btn-start trading-ai-action" onClick={() => generateAiProposals('momentum')} {...demoActionButtonProps(isAiLoading)} style={{ padding: '0.8rem 1.5rem', background: '#10b981', color: '#000', border: '1px solid #10b981', ...demoActionStyle }}>
              {isAiLoading ? 'Analisi...' : 'Trend / Momentum'}
            </button>
          </div>
        </div>

        {executionMessage && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '1.5rem', color: executionMessage.includes('Errore') ? '#ef4444' : '#10b981', textAlign: 'center' }}>
            {executionMessage}
          </div>
        )}

        {aiProposals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {aiProposals.map(prop => (
              <div key={prop.id} style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ background: prop.risk === 'Conservativo' ? 'rgba(16, 185, 129, 0.2)' : prop.risk === 'Bilanciato' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: prop.risk === 'Conservativo' ? '#10b981' : prop.risk === 'Bilanciato' ? '#38bdf8' : '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {prop.risk}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{prop.asset_type}</span>
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#e2e8f0' }}>{prop.title}</h4>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem' }}>{prop.symbol}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4', flex: 1 }}>{prop.rationale}</p>
                <button className="btn" onClick={() => executeAiProposal(prop)} {...demoActionButtonProps()} style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid #10b981', color: '#10b981', ...demoActionStyle }}>
                  Investi ${aiBudget} su {prop.symbol}
                </button>
              </div>
            ))}
          </div>
        )}

        {status.ai_investments && status.ai_investments.length > 0 && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <h4 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <span>📊</span> Registro Investimenti AI Piazzati
            </h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
              <table className="data-table" style={{ width: '100%', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '1rem' }}>Asset</th>
                    <th>Simbolo</th>
                    <th>Importo ($)</th>
                    <th>Piattaforma</th>
                    <th>Orario</th>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {status.ai_investments.map((inv, idx) => (
                    <tr key={idx} className="data-row" style={{ padding: '0' }}>
                      <td style={{ padding: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{inv.asset_type}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#38bdf8' }}>{inv.symbol}</td>
                      <td style={{ padding: '1rem', color: '#10b981', fontWeight: 'bold' }}>${Number(inv.amount_usd).toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: '#e2e8f0' }}>{inv.platform}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{inv.timestamp}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => cancelAiInvestment(idx, inv.symbol, inv.platform)}
                          style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.4rem 0.8rem', fontSize: '0.8rem', minHeight: '0' }}
                        >
                          Annulla Ordine
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card col-span-4">
          <div className="card-title">Portafoglio Virtuale</div>
          <div className="portfolio-value">${Number(status.portfolio_value || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Capitale Investito</div>
          <div className="portfolio-value">
            ${(Object.values(status.positions || {}).reduce((sum, p) => sum + (p !== "LIQUID" ? Math.abs(p.market_value || 0) : 0), 0)).toFixed(2)}
          </div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Liquidità Libera</div>
          <div className="portfolio-value" style={{ color: '#10b981' }}>${Number(status.cash || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">P/L Tempo Reale</div>
          <div className="portfolio-value" style={{ color: Number(status.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
            {Number(status.profit || 0) >= 0 ? '+' : ''}{Number(status.profit || 0).toFixed(2)}
          </div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Win Rate</div>
          <div className="portfolio-value" style={{ color: '#f59e0b' }}>{Number(status.win_rate || 0).toFixed(1)}%</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Profit Factor</div>
          <div className="portfolio-value" style={{ color: '#8b5cf6' }}>{Number(status.profit_factor || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Sharpe Ratio</div>
          <div className="portfolio-value" style={{ color: '#00d4aa' }}>{Number(status.sharpe_ratio || 0).toFixed(2)}</div>
        </div>
        <div className="card col-span-4">
          <div className="card-title">Max Drawdown</div>
          <div className="portfolio-value" style={{ color: '#ef4444' }}>-{Number(status.max_drawdown || 0).toFixed(2)}%</div>
        </div>
      </div>


      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <RiskStatus />
        <CapitalPhase />
      </div>

      <div className="chart-controls trading-chart-controls" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <div className="trading-symbol-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {status.symbols?.map(sym => (
            <button key={sym} className={`tab-btn ${selectedSymbol === sym ? 'active-tab' : ''}`} onClick={() => setSelectedSymbol(sym)}>{sym}</button>
          ))}
        </div>
        <div className="trading-timeframe-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {['1D', '1W', '1M', '1Y', 'ALL'].map(tf => (
            <button key={tf} className={`tab-btn ${timeframe === tf ? 'active-tab' : ''}`} onClick={() => setTimeframe(tf)}>{tf}</button>
          ))}
        </div>
      </div>

      <div className="chart-container" style={{ height: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', marginTop: '1rem', position: 'relative' }}>
        {!status.modules?.trading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Bot Offline. Il grafico si popolerà in tempo reale all'avvio.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <div className="card col-span-6">
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
                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>📊 Indicatori:</span>
                      <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {status.table_data.find(r => r.symbol === sym).prediction}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>🧠 AI Sentiment:</span>
                      <span>
                        {status.table_data.find(r => r.symbol === sym).sentiment === 'BULLISH' && <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 BULLISH (+15% Boost)</span>}
                        {status.table_data.find(r => r.symbol === sym).sentiment === 'BEARISH' && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 BEARISH (VETO Attivo)</span>}
                        {status.table_data.find(r => r.symbol === sym).sentiment === 'NEUTRAL' && <span style={{ color: 'var(--text-secondary)' }}>⚪ NEUTRAL</span>}
                      </span>
                    </div>
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
              disabled={isDemoMode}
              onChange={async (e) => {
                const val = e.target.value;
                setStatus(prev => ({ ...prev, aggressiveness: val }));
                await authFetch('/api/config', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ aggressiveness: val })
                });
              }}
              style={{ width: '100%', accentColor: '#06b6d4', ...demoActionStyle }}
            />
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 'bold' }}>Selezione dinamica titoli</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Ranking su momentum, liquidità e volatilità
                </div>
              </div>
              <button
                className="btn"
                onClick={async () => {
                  const res = await authFetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_symbols: true, symbol_count: 7 })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setStatus(prev => ({ ...prev, symbols: data.symbols, symbol_selection: data.symbol_selection }));
                  }
                }}
                {...demoActionButtonProps()}
                style={demoActionStyle}
              >
                AGGIORNA WATCHLIST
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {status.symbols?.join(' • ') || 'Nessun simbolo disponibile'}
            </div>
            {status.symbol_selection?.ranked?.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                {status.symbol_selection.ranked.map((row) => (
                  <div
                    key={row.symbol}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{row.symbol}</div>
                      <div style={{ color: '#06b6d4', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        score {Number(row.score || 0).toFixed(3)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {row.selection_reason || 'Selezione dinamica attiva'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card col-span-6">
          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Terminale Scansione</h3>
          <div className="terminal-window">
            {!status.modules?.trading ? (
              <div style={{ color: 'var(--text-secondary)' }}>Bot Offline. Avvia il trading IA per iniziare la scansione del mercato...</div>
            ) : (
              <>
                {status.logs?.map((l, i) => (
                  <div key={i} style={{ marginBottom: '0.3rem' }}>{l}</div>
                ))}
                {(!status.logs || status.logs.length === 0) && <div>In attesa di dati dal server...</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  
  const renderArbitrageView = () => {
    const highRiskTokens = ["DOGE", "SHIB", "PEPE", "WIF", "LINK"];
    return (
      <div className="module-content module-content--defi">
        <div className="header module-page-header defi-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2>DeFi Arbitrage <span className="badge badge-gold" style={{ marginLeft: '1rem', verticalAlign: 'middle' }}>MODALITÀ SIMULAZIONE ATTIVA</span></h2>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Esecuzione automatica live (Paper Trading)</div>
            <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'inline-block' }}>
              <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Portafoglio Virtuale:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>${Number(status.portfolio_value || 0).toFixed(2)}</span>
            </div>
          </div>
          <button 
            className={`btn ${status.modules?.crypto_arb ? 'btn-stop' : 'btn-start'}`}
            onClick={() => toggleModule('crypto_arb', status.modules?.crypto_arb)}
            {...demoActionButtonProps()}
            style={demoActionStyle}
          >
            {status.modules?.crypto_arb ? 'FERMA ARBITRAGGIO' : 'ATTIVA MOTORE ARBITRAGGIO'}
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="card col-span-4" style={{ textAlign: "center" }}>
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png" alt="Binance" style={{ width: '40px', height: '40px', objectFit: 'cover', marginBottom: '1rem', borderRadius: '50%' }} />
            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Binance (Ask)</h3>
            <div className="crypto-price" style={{ color: '#06b6d4', marginTop: '1rem' }}>
              ${Number(status.arb_prices?.binance || 0).toFixed(2)}
            </div>
          </div>

          <div className="card col-span-4" style={{ textAlign: "center" }}>
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/24.png" alt="Kraken" style={{ width: '40px', height: '40px', objectFit: 'cover', marginBottom: '1rem', borderRadius: '50%' }} />
            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Kraken (Ask)</h3>
            <div className="crypto-price" style={{ color: '#3b82f6', marginTop: '1rem' }}>
              ${Number(status.arb_prices?.kraken || 0).toFixed(2)}
            </div>
          </div>
          
          <div className="card col-span-4" style={{ textAlign: "center", borderColor: "rgba(16,185,129,0.3)" }}>
            <h3 style={{ color: '#10b981', margin: 0, fontSize: '1rem' }}>Spread Attuale</h3>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.5rem' }}>
              {Math.abs(Number(status.arb_prices?.binance || 0) - Number(status.arb_prices?.kraken || 0)).toFixed(2)}$
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Soglia profitto netto: ~120$ (0.2%)</div>
          </div>
        </div>

        <h3 style={{ color: '#e2e8f0', marginTop: '2rem', marginBottom: '1rem' }}>Radar Inefficienze BTC</h3>
        <div style={{ background: '#000', padding: '1.5rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          {status.arb_logs?.map((l, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("TROVATO") ? '#f59e0b' : '#10b981' }}>{l}</div>
          ))}
          {(!status.arb_logs || status.arb_logs.length === 0) && (
            <div style={{ color: '#64748b' }}>Radar inattivo. Clicca su Attiva Motore Arbitraggio per iniziare la scansione dei due Exchange...</div>
          )}
        </div>

        <hr style={{ margin: '4rem 0 3rem 0', borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* --- HIGH RISK ARBITRAGE SECTION --- */}
        <div className="header defi-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <span>⚠️</span> DeFi Arbitrage - HIGH RISK (Altcoins & Meme)
            </h2>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Scansione e hedging automatico su asset ad alta volatilità (DOGE, SHIB, PEPE, WIF, LINK)</div>
          </div>
          <div className="defi-highrisk-actions" style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${status.auto_bet_enabled ? 'btn-stop' : 'btn-start'}`}
              style={{ background: status.auto_bet_enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.8)', border: '1px solid #10b981', color: '#fff' }}
              onClick={() => {
                authFetch('/api/auto-bet-settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled: !status.auto_bet_enabled })
                });
              }}
              {...demoActionButtonProps()}
            >
              ⚙️ AUTO-SCALPING AI {status.auto_bet_enabled ? '(ON)' : '(OFF)'}
            </button>
            <button 
              className={`btn ${status.modules?.high_risk_crypto_arb ? 'btn-stop' : 'btn-start'}`}
              style={{ background: status.modules?.high_risk_crypto_arb ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.6)', border: '1px solid #ef4444', color: '#fff' }}
              onClick={() => toggleModule('high_risk_crypto_arb', status.modules?.high_risk_crypto_arb)}
              {...demoActionButtonProps()}
            >
              {status.modules?.high_risk_crypto_arb ? 'FERMA ALTO RISCHIO' : 'ATTIVA MOTORE ALTO RISCHIO'}
            </button>
          </div>
        </div>

        {/* Real-time prices grid for Altcoins */}
        <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', marginBottom: '2rem' }}>
          <table className="data-table">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <th style={{ padding: '0.8rem 1rem' }}>Asset</th>
                <th style={{ padding: '0.8rem 1rem' }}>Binance Ask</th>
                <th style={{ padding: '0.8rem 1rem' }}>Kraken Ask</th>
                <th style={{ padding: '0.8rem 1rem' }}>Spread Attuale</th>
                <th style={{ padding: '0.8rem 1rem' }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {highRiskTokens.map(token => {
                const bPrice = status.high_risk_arb_prices?.[token]?.binance || 0;
                const kPrice = status.high_risk_arb_prices?.[token]?.kraken || 0;
                const spread = Math.abs(bPrice - kPrice);
                const spreadPerc = bPrice > 0 ? (spread / bPrice) * 100 : 0;
                
                return (
                  <tr key={token} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{token}/USD</td>
                    <td style={{ padding: '1rem', color: '#06b6d4' }}>${bPrice > 0 ? bPrice.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4) : 'N/A'}</td>
                    <td style={{ padding: '1rem', color: '#3b82f6' }}>${kPrice > 0 ? kPrice.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4) : 'N/A'}</td>
                    <td style={{ padding: '1rem', color: spreadPerc > 0.1 ? '#10b981' : 'var(--text-secondary)' }}>
                      ${spread.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4)} ({spreadPerc.toFixed(3)}%)
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${spreadPerc > 0.2 ? 'badge-active' : 'badge-idle'}`} style={{ fontSize: '0.8rem' }}>
                        {spreadPerc > 0.2 ? 'SPREAD RILEVATO' : 'MONITORANDO'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 style={{ color: '#ef4444', marginTop: '2rem', marginBottom: '1rem' }}>Radar Inefficienze HIGH RISK</h3>
        <div className="terminal-window" style={{ height: "250px" }}>
          {status.high_risk_arb_logs?.map((l, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("HEDGE") || l.includes("SCALP") ? '#f59e0b' : '#f87171' }}>{l}</div>
          ))}
          {(!status.high_risk_arb_logs || status.high_risk_arb_logs.length === 0) && (
            <div style={{ color: '#78716c' }}>Radar ad alto rischio inattivo. Clicca su Attiva Motore Alto Rischio per avviare il monitoraggio dei book...</div>
          )}
        </div>

        <hr style={{ margin: '3rem 0 2rem 0', borderColor: 'rgba(239, 68, 68, 0.15)' }} />

        {/* --- VOLATILITY RADAR + QUICK SCALPING --- */}
        <div className="defi-volatility-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem' }}>🌡️</div>
          <div>
            <h2 style={{ margin: 0, color: '#f59e0b' }}>Volatility Radar & Quick Scalping</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
              Top 5 crypto più volatili nelle ultime 24h — buy/sell rapido con 1 click
            </div>
          </div>
        </div>

        {/* Size selector */}
        <div className="defi-size-selector" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Size trade:</span>
          {[50, 100, 250, 500].map(s => (
            <button
              key={s}
              onClick={() => setTradeSize(s)}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold',
                background: tradeSize === s ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                color: tradeSize === s ? '#000' : 'var(--text-primary)',
                border: tradeSize === s ? 'none' : '1px solid rgba(255,255,255,0.1)'
              }}
            >${s}</button>
          ))}
          <span className="defi-balance-label" style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 'bold' }}>
            💰 Saldo Virtuale: ${Number(status.cash || 0).toFixed(2)}
          </span>
        </div>

        {/* Volatile assets table with BUY/SELL buttons */}
        {(!status.high_risk_volatile_assets || status.high_risk_volatile_assets.length === 0) ? (
          <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: '#78716c' }}>
            🌡️ Radar inattivo — Attiva il motore HIGH RISK per scoprire le top crypto più volatili del momento
          </div>
        ) : (
          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.15)', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.9rem 1rem' }}>Rank</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Token</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Prezzo</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Volatilità 24h</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Variazione %</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Quick Trade</th>
                </tr>
              </thead>
              <tbody>
                {status.high_risk_volatile_assets.map((asset, i) => {
                  const isPositive = asset.change_24h >= 0;
                  const isVeryVolatile = asset.volatility > 10;
                  const decimals = asset.price < 0.01 ? 8 : asset.price < 1 ? 6 : 4;
                  return (
                    <tr key={asset.symbol} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                      <td style={{ padding: '0.9rem 1rem', color: '#f59e0b', fontWeight: 'bold' }}>#{i + 1}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div
                          onClick={isDemoMode ? undefined : () => openAiSignal(asset)}
                          style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '1rem', cursor: isDemoMode ? 'not-allowed' : 'pointer', textDecoration: 'underline dotted', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: isDemoMode ? 0.5 : 1 }}
                          title="Clicca per analisi AI"
                        >
                          🤖 {asset.symbol}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{asset.pair}</div>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#e2e8f0' }}>${asset.price.toFixed(decimals)}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{
                          background: isVeryVolatile ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                          color: isVeryVolatile ? '#ef4444' : '#f59e0b',
                          padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold'
                        }}>
                          {asset.volatility.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {isPositive ? '+' : ''}{asset.change_24h.toFixed(2)}%
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            id={`buy-${asset.symbol}`}
                            onClick={() => quickTrade(asset.symbol, 'buy', tradeSize)}
                            disabled={isDemoMode}
                            style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isDemoMode ? 0.5 : 1 }}
                          >⬆ BUY</button>
                          <button
                            id={`sell-${asset.symbol}`}
                            onClick={() => quickTrade(asset.symbol, 'sell', tradeSize)}
                            disabled={isDemoMode}
                            style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isDemoMode ? 0.5 : 1 }}
                          >⬇ SELL</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tradeResult && (
          <div style={{
            marginTop: '1rem', padding: '0.8rem 1.2rem', borderRadius: '8px',
            background: tradeResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${tradeResult.error ? '#ef4444' : '#10b981'}`,
            color: tradeResult.error ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontSize: '0.9rem'
          }}>
            {tradeResult.error
              ? `❌ ${tradeResult.error}`
              : `✅ ${tradeResult.side?.toUpperCase()} ${tradeResult.qty} ${tradeResult.symbol} @ $${tradeResult.price?.toFixed ? tradeResult.price.toFixed(6) : tradeResult.price} — Saldo: $${tradeResult.virtual_cash}${tradeResult.monitored ? ' — 👁️ IN SORVEGLIANZA' : ''}`
            }
          </div>
        )}

        {/* ===== POSIZIONI SORVEGLIATE ===== */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.3rem' }}>👁️</span>
            <h3 style={{ margin: 0, color: '#a78bfa' }}>Posizioni in Sorveglianza Auto-Exit</h3>
            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {(status.monitored_positions || []).length} APERTE
            </span>
          </div>
          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(167,139,250,0.08)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Token</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Buy Price</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Target / Picco</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>📊 P&L</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Trend</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Qty</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Investito</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Ore</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {(!status.monitored_positions || status.monitored_positions.length === 0) ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nessuna posizione in sorveglianza. Acquista un token per iniziare.</td></tr>
                ) : status.monitored_positions.map((pos, i) => {
                    const dec = pos.buy_price < 0.01 ? 8 : pos.buy_price < 1 ? 6 : 4;
                    const currentPrice = status.high_risk_arb_prices?.[pos.symbol]?.binance || pos.buy_price;
                    const pnlPct = ((currentPrice - pos.buy_price) / pos.buy_price) * 100;
                    const pnlColor = pnlPct >= 0 ? '#10b981' : '#ef4444';
                    
                    const sparklineData = pos.price_history ? pos.price_history.map(ph => ({ pnl: ((ph.price - pos.buy_price) / pos.buy_price) * 100 })) : [];

                    return (
                      <tr key={`${pos.symbol}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                        <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', color: '#a78bfa' }}>
                          <span 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: isDemoMode ? 'not-allowed' : 'pointer', opacity: isDemoMode ? 0.5 : 1 }}
                            onClick={isDemoMode ? undefined : () => openAiSignal({ symbol: pos.symbol, price: currentPrice, volatility: 0, change_24h: 0 })}
                            title="Chiedi all'IA"
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                            <span style={{ borderBottom: '1px dashed #a78bfa' }}>{pos.symbol}</span>
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: '#e2e8f0' }}>${Number(pos.buy_price).toFixed(dec)}</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#f59e0b' }}>
                          {pos.target_price && <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>🎯 ${Number(pos.target_price).toFixed(dec)}</div>}
                          <div>${Number(pos.peak_price || pos.buy_price).toFixed(dec)}</div>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: pnlColor, fontWeight: 'bold' }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</td>
                        <td style={{ padding: '0.8rem 1rem' }}>
                           <HighRiskPnLSparkline history={sparklineData} />
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>{Number(pos.qty).toFixed(4)}</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>${Number(pos.amount).toFixed(2)}</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>{pos.timestamp}</td>
                        <td style={{ padding: '0.8rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              const t = prompt(`Inserisci Target Price per ${pos.symbol}:`, pos.target_price || '');
                              if (t !== null) {
                                authFetch('/api/high-risk/set-target', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ symbol: pos.symbol, target_price: t ? parseFloat(t) : null })
                                });
                              }
                            }}
                            disabled={isDemoMode}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', cursor: 'pointer', fontSize: '0.8rem' }}
                            title="Set Target Price"
                          >🎯</button>
                          <button
                            onClick={() => quickTrade(pos.symbol, 'sell', pos.amount)}
                            disabled={isDemoMode}
                            style={{ padding: '0.35rem 0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          >✕ Chiudi</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(167,139,250,0.05)', color: '#64748b', fontSize: '0.78rem', borderTop: '1px solid rgba(167,139,250,0.1)' }}>
                🔔 Trailing stop: -1.5% dal picco | 🛡️ Stop loss: -5% dal buy price | Controllo ogni 30 sec
              </div>
            </div>
          </div>
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🔄</span>
            <h3 style={{ margin: 0, color: '#fcd34d' }}>Re-Entry Watchlist</h3>
            <span style={{ background: 'rgba(252,211,77,0.15)', color: '#fcd34d', border: '1px solid #fcd34d', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {(status.reentry_watchlist || []).length} IN ATTESA
            </span>
          </div>
          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(252,211,77,0.04)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(252,211,77,0.08)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Token</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Exit Price (Prev)</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Re-entry Trigger (Drop)</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Qty Base</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Tentativo</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {(!status.reentry_watchlist || status.reentry_watchlist.length === 0) ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nessun token in attesa di rientro automatico.</td></tr>
                ) : status.reentry_watchlist.map((pos, i) => {
                    const dec = pos.exit_price < 0.01 ? 8 : pos.exit_price < 1 ? 6 : 4;
                    const trigger = pos.exit_price * (1 - pos.drop_target);
                    return (
                      <tr key={`${pos.symbol}-reentry-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                        <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', color: '#fcd34d' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            {pos.symbol}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: '#e2e8f0' }}>${Number(pos.exit_price).toFixed(dec)}</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#ef4444' }}>${Number(trigger).toFixed(dec)} ({(pos.drop_target * 100).toFixed(1)}%)</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>{Number(pos.qty).toFixed(4)}</td>
                        <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{pos.attempts} / 3</td>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <button
                            onClick={() => {
                              authFetch('/api/high-risk/cancel-reentry', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ symbol: pos.symbol })
                              });
                            }}
                            disabled={isDemoMode}
                            style={{ padding: '0.35rem 0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          >✕ Annulla</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(252,211,77,0.05)', color: '#64748b', fontSize: '0.78rem', borderTop: '1px solid rgba(252,211,77,0.1)' }}>
                🔄 Ricompra automatica quando il prezzo cala e c'è segnale BUY. Massimo 3 tentativi.
              </div>
            </div>
          </div>
      </div>
    );
  };

  
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
    <div className="module-content module-content--sports">
      <div className="header module-page-header sports-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Sports SureBets ⚽🎾</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Calcolatore Matematico di Scommesse Sicure</div>
        </div>
        <button 
          className={`btn ${status.modules?.sports_arb ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('sports_arb', status.modules?.sports_arb)}
          {...demoActionButtonProps()}
          style={demoActionStyle}
        >
          {status.modules?.sports_arb ? 'FERMA RADAR QUOTE' : 'ATTIVA RADAR QUOTE'}
        </button>
      </div>

      {/* --- Pannello Auto-Bet --- */}
      <div className="sports-auto-bet-panel" style={{
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
            onClick={isDemoMode ? undefined : async () => {
              const newVal = !status.auto_bet_enabled;
              setStatus(prev => ({ ...prev, auto_bet_enabled: newVal }));
              await authFetch('/api/auto-bet-settings', {
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
              cursor: isDemoMode ? 'not-allowed' : 'pointer',
              position: 'relative',
              transition: 'background 0.3s',
              flexShrink: 0,
              opacity: isDemoMode ? 0.5 : 1
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
            disabled={isDemoMode}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setStatus(prev => ({ ...prev, auto_bet_threshold: val }));
            }}
            onMouseUp={async (e) => {
              const val = parseFloat(e.target.value);
              await authFetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            onTouchEnd={async (e) => {
              const val = parseFloat(e.target.value);
              await authFetch('/api/auto-bet-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: val })
              });
            }}
            style={{ flex: 1, accentColor: '#d4af37', cursor: isDemoMode ? 'not-allowed' : 'pointer', opacity: isDemoMode ? 0.5 : 1 }}
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

      <div className="dashboard-grid">
        {/* Radar Logs */}
        <div className="card col-span-6">
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
        <div className="card col-span-6">
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
                  <div className="card col-span-6">
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
                      {...demoActionButtonProps(betState === 'loading')}
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
                        cursor: isDemoMode ? 'not-allowed' : (betState === 'loading' ? 'wait' : 'pointer'),
                        letterSpacing: '1px',
                        transition: 'all 0.2s',
                        opacity: isDemoMode ? 0.5 : 1,
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
      <div className="module-content module-content--sentiment">
      <div className="header module-page-header sentiment-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            🤖 AI Sentiment Radar
            <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              powered by NewsAPI & NLP
            </span>
          </h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Segnali di mercato dall'analisi del sentiment globale (Crypto & Stock)</div>
        </div>
        
        <div className="sentiment-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button 
            className={`toggle-btn ${status.modules?.ai_sports_sentiment ? 'active' : ''}`}
            onClick={() => toggleModule('ai_sports_sentiment')}
            {...demoActionButtonProps()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...demoActionStyle }}
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

      <div className="sentiment-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
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
                <div className="card col-span-6">
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
      const payload = { groq_key: apiKeys.groq_key || savedKeys.GROQ_KEY || "" };
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
      const res = await authFetch('/api/ai/upload-video', {
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
    <div className="module-content module-content--aicontent">
      <div className="header module-page-header ai-content-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>AI Content Spammer 🤖🔥</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Ti diamo l'idea, tu crei il video, Aureo lo spamma ovunque!</div>
        </div>
        <button 
          className={`btn ${status.modules?.ai_content ? 'btn-stop' : 'btn-start'}`}
          onClick={() => toggleModule('ai_content', status.modules?.ai_content)}
          {...demoActionButtonProps()}
          style={demoActionStyle}
        >
          {status.modules?.ai_content ? 'FERMA DISTRIBUZIONE (PAUSA CODA)' : 'AVVIA DISTRIBUZIONE (ELABORA CODA)'}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
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
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>2. Integrazione API Social (Opzionale)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Collega gli account per la pubblicazione automatica dei video generati.</p>
            <input type="text" placeholder="YouTube Data API Key" value={apiKeys.youtube_key || ''} onChange={e => setApiKeys({...apiKeys, youtube_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '0.5rem' }} />
            <input type="text" placeholder="TikTok Access Token" value={apiKeys.tiktok_key || ''} onChange={e => setApiKeys({...apiKeys, tiktok_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
        </div>

        <div className="card col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', opacity: aiIdea ? 1 : 0.5, pointerEvents: aiIdea ? 'auto' : 'none' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>3. Carica Video Generato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Genera il video gratuitamente su Veo incollando il prompt, scarica l'MP4 e caricalo qui.</p>
            <input type="file" id="video-upload" accept="video/mp4" style={{ display: 'none' }} onChange={handleVideoUpload} />
            <button 
              onClick={() => document.getElementById('video-upload').click()}
              {...demoActionButtonProps(uploadingVideo)}
              style={{ background: '#10b981', color: '#000', width: '100%', padding: '1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', opacity: uploadingVideo ? 0.7 : 1 }}
            >
              {uploadingVideo ? '⏳ Caricamento in coda...' : '📤 Carica MP4'}
            </button>
          </div>

          <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>Logs di Distribuzione</h4>
            {status.ai_logs?.map((l, i) => (
              <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("✅") || l.includes("💰") ? '#10b981' : l.includes("Upload") ? '#f59e0b' : '#c084fc' }}>{l}</div>
            ))}
            {(!status.ai_logs || status.ai_logs.length === 0) && (
              <div style={{ color: '#64748b' }}>In attesa di video in coda...</div>
            )}
          </div>
          <div className="card col-span-6">
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
                    <div className="card col-span-6">
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
          {...demoActionButtonProps()}
          style={{ fontSize: '1.2rem', padding: '1rem 3rem', ...demoActionStyle }}
        >
          {status.modules?.[mod_id] ? 'DISATTIVA MOTORE' : 'ATTIVA MOTORE'}
        </button>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
          {status.modules?.[mod_id] ? 'Il motore è attivo e gira in background.' : 'Attualmente in pausa.'}
        </p>
      </div>
    </div>
  );

  const renderSaaSView = () => {
    const overview = billingOverview || DEMO_BILLING_OVERVIEW;
    const metrics = overview.metrics || {};
    const plans = overview.plans || [];
    const customers = overview.customers || [];
    const leads = overview.leads || [];
    const activity = overview.recent_activity || [];

    return (
      <div className="module-content module-content--billing">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2>💳 SaaS & Billing Control Room</h2>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Gestisci piani, lead, clienti e monetizzazione dell’ecosistema Aureo.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            {isDemoMode && <div className="demo-mode-pill">READ ONLY</div>}
            <div className={`sync-pill ${billingLoading ? 'offline' : 'online'}`}>{billingLoading ? 'Sync…' : 'Billing Ready'}</div>
          </div>
        </div>

        {billingMessage && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(245, 166, 35, 0.2)' }}>
            <div style={{ color: '#f8e7bf' }}>{billingMessage}</div>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="card col-span-3">
            <div className="card-title">MRR</div>
            <div className="portfolio-value" style={{ color: '#10b981' }}>€{Number(metrics.monthly_recurring_revenue || 0).toFixed(0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">ARR</div>
            <div className="portfolio-value" style={{ color: '#38bdf8' }}>€{Number(metrics.annual_run_rate || 0).toFixed(0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">Clienti Attivi</div>
            <div className="portfolio-value">{Number(metrics.active_customers || 0)}</div>
          </div>
          <div className="card col-span-3">
            <div className="card-title">Trial / Lead</div>
            <div className="portfolio-value" style={{ color: '#f59e0b' }}>
              {Number(metrics.trialing_customers || 0)} / {Number(metrics.leads_count || 0)}
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
          <div className="card col-span-12">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>Clienti Iscritti</h3>
              <button 
                className="btn" 
                onClick={() => setShowCreateUser(!showCreateUser)}
                style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.9rem' }}
              >
                {showCreateUser ? 'Annulla' : '+ Crea Utente'}
              </button>
            </div>

            {showCreateUser && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Nuovo Utente</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Email</label>
                    <input type="email" className="settings-input" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@esempio.com" />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Password Temporanea</label>
                    <input type="text" className="settings-input" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Pass123!" />
                  </div>
                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Ruolo</label>
                    <select className="settings-input" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button 
                    className="btn btn-start" 
                    onClick={async () => {
                      if (!newUser.email || !newUser.password) { alert('Compila email e password'); return; }
                      try {
                        const res = await authFetch('/api/saas/create-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newUser)
                        });
                        const data = await res.json();
                        if (res.ok) {
                          alert(data.message);
                          setShowCreateUser(false);
                          setNewUser({email:'', password:'', role:'user'});
                          const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                          setBillingOverview(await res2.json());
                        } else {
                          alert(data.detail || 'Errore creazione utente');
                        }
                      } catch(e) { alert('Errore di connessione'); }
                    }}
                    style={{ minHeight: '42px', padding: '0 1.5rem' }}
                  >
                    Salva
                  </button>
                </div>
              </div>
            )}

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                    <th>Scadenza</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {customers?.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{user.email}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>registrato: {user.created_at ? user.created_at.slice(0,10) : '-'}</div>
                      </td>
                      <td>
                        {user.status === 'active' && user.is_paid && <span className="badge badge-active" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>ATTIVO</span>}
                        {user.status === 'active' && !user.is_paid && <span className="badge badge-idle" style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid #475569' }}>ATTIVATO GRATIS</span>}
                        {user.status === 'pending' && <span className="badge badge-idle" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }}>IN ATTESA</span>}
                      </td>
                      <td>
                        {user.is_paid
                          ? <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Pagato<br/><span style={{color:'#64748b', fontSize:'0.75rem', fontWeight:400}}>{user.paid_at ? user.paid_at.slice(0,10) : ''}</span></span>
                          : <span style={{ color: '#94a3b8' }}>🎁 Gratis</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user.next_billing_at !== 'N/A' ? user.next_billing_at?.slice(0,10) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {user.status !== 'active' && (
                            <>
                            <button className="btn btn-start" onClick={async () => {
                              if(!window.confirm('Vuoi attivare manualmente questo utente (GRATIS)?')) return;
                              try {
                                await authFetch('/api/saas/activate-user', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ user_id: user.id })
                                });
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                              Attiva (Gratis)
                            </button>
                            <button className="btn btn-start" onClick={async () => {
                              if(!window.confirm('Vuoi attivare manualmente questo utente (PAGATO)?')) return;
                              try {
                                await authFetch('/api/saas/activate-paid', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ user_id: user.id })
                                });
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: '#d4af37', color: 'black' }}>
                              Attiva (Pagato)
                            </button>
                            </>
                          )}
                          <button className="btn btn-outline" onClick={async () => {
                            if(!window.confirm('Eliminare definitivamente questo utente?')) return;
                            try {
                              await authFetch('/api/saas/delete-user', {
                                method: 'POST', headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ user_id: user.id })
                              });
                              const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                              setBillingOverview(await res2.json());
                            } catch(e) {}
                          }} style={{ width: 'auto', minHeight: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderColor: '#ef4444', color: '#ef4444' }}>
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!customers?.length && <tr><td colSpan="5" style={{textAlign:'center', color:'#888'}}>Nessun cliente registrato</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-12">
            <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Verifica Pagamenti Crypto</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Importo</th>
                    <th>TXID</th>
                    <th>Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {billingOverview?.recent_activity?.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.user_email}</td>
                      <td>{payment.amount} {payment.currency}</td>
                      <td style={{fontFamily:'monospace', fontSize:'0.8rem', maxWidth:'150px', overflow:'hidden', textOverflow:'ellipsis'}} title={payment.txid}>{payment.txid}</td>
                      <td>
                        {payment.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-start" onClick={async () => {
                              try {
                                const res = await authFetch('/api/billing/verify-payment', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ payment_id: payment.id, action: 'approve', months: 1 })
                                });
                                const data = await res.json();
                                setBillingMessage(data.message);
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.45rem 0.7rem' }}>
                              Verifica (1 Mese)
                            </button>
                            <button className="btn btn-outline" onClick={async () => {
                              try {
                                const res = await authFetch('/api/billing/verify-payment', {
                                  method: 'POST', headers: {'Content-Type': 'application/json'},
                                  body: JSON.stringify({ payment_id: payment.id, action: 'reject' })
                                });
                                const data = await res.json();
                                setBillingMessage(data.message);
                                const res2 = await authFetch('/api/saas/overview?t=' + Date.now());
                                setBillingOverview(await res2.json());
                              } catch(e) {}
                            }} style={{ width: 'auto', minHeight: 0, padding: '0.45rem 0.7rem' }}>
                              Rifiuta
                            </button>
                          </div>
                        ) : (
                          <span style={{color: payment.status === 'verified' ? '#10b981' : '#f43f5e'}}>{(payment.status || 'unknown').toUpperCase()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!billingOverview?.recent_activity?.length && <tr><td colSpan="4" style={{textAlign:'center', color:'#888'}}>Nessun pagamento in coda</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-4">
            <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Attività Recenti</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {activity.map((item) => (
                <div key={item.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.85rem 0.9rem' }}>
                  <div style={{ color: '#e2e8f0', lineHeight: 1.35 }}>{item.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: '0.4rem' }}>{item.created_at}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  
  if (!isAuthenticated) {

    const landingPlans = DEMO_BILLING_OVERVIEW.plans || [];
    const selectedPlan = landingPlans.find((plan) => plan.id === selectedPlanId);
    const landingTicker = [
      { market: 'BTC/USD', price: '$118,420', change: '+2.6%', direction: 'up' },
      { market: 'ETH/USD', price: '$6,180', change: '+1.9%', direction: 'up' },
      { market: 'SOL/USD', price: '$242', change: '+4.2%', direction: 'up' },
      { market: 'GOLD', price: '$2,612', change: '-0.4%', direction: 'down' },
      { market: 'NASDAQ', price: '21,440', change: '+0.8%', direction: 'up' },
      { market: 'EUR/USD', price: '1.11', change: '+0.2%', direction: 'up' },
    ];
    const landingStats = [
      { value: '24/7', label: 'visibilità costante su capitale, segnali e rischio' },
      { value: 'Multi-device', label: 'esperienza fluida su iPhone, Android, tablet e desktop' },
      { value: '3 step', label: 'accessi pensati per livelli operativi diversi' },
    ];
    const landingFeatures = [
      {
        icon: '🧠',
        title: 'AI Avanzata',
        text: 'Algoritmi e letture assistite aiutano a interpretare contesto, opportunità e segnali in tempo reale con più lucidità.',
      },
      {
        icon: '⚡',
        title: 'Esecuzione più rapida',
        text: 'Interfaccia, dati e moduli sono organizzati per ridurre attrito e trasformare più in fretta l’analisi in azione.',
      },
      {
        icon: '🛡️',
        title: 'Sicurezza premium',
        text: 'Accesso biometrico, gestione chiavi e percorsi protetti rafforzano la percezione di solidità fin dal primo ingresso.',
      },
      {
        icon: '📊',
        title: 'Control room evoluta',
        text: 'Dashboard, trading, DeFi e lettura di segnali convivono in un unico ambiente credibile e leggibile.',
      },
      {
        icon: '📱',
        title: 'Multi-device reale',
        text: 'L’esperienza resta forte e pulita su iPhone, Android, tablet e desktop, senza perdere presenza visiva.',
      },
      {
        icon: '🎧',
        title: 'Percorso guidato',
        text: 'Dalla prima impressione fino all’accesso, ogni passaggio accompagna l’utente senza spezzare fiducia e attenzione.',
      },
    ];
    const landingFlow = [
      {
        number: '1',
        title: 'Scopri il sistema',
        text: 'La pagina iniziale mostra subito posizionamento, forza visiva e valore percepito del prodotto.',
      },
      {
        number: '2',
        title: 'Scegli lo step',
        text: 'L’utente capisce con chiarezza quale accesso è più adatto al suo profilo, senza confusione.',
      },
      {
        number: '3',
        title: 'Entra senza attrito',
        text: 'Registrazione o accesso avvengono nella stessa esperienza, mantenendo continuità e qualità percepita.',
      },
    ];
    const landingTestimonials = [
      {
        initials: 'MQ',
        name: 'Marco',
        role: 'Private investor',
        quote: 'La prima impressione è forte: sembra un ambiente serio, ordinato e costruito per chi vuole controllo vero.',
      },
      {
        initials: 'GV',
        name: 'Giulia',
        role: 'Consulente indipendente',
        quote: 'Non comunica solo funzionalità, comunica posizionamento. Questo cambia molto la percezione del prodotto.',
      },
      {
        initials: 'LD',
        name: 'Luca',
        role: 'Trader attivo',
        quote: 'Finalmente una presentazione che accompagna bene alla scelta, senza buttarti subito dentro un login freddo.',
      },
    ];
    const landingTrustPillars = [
      'Presenza visiva premium',
      'Percorso lineare verso l’accesso',
      'Coerenza piena tra presentazione e utilizzo',
    ];
    if (showLanding) {
      return (
        <div className="sales-landing">
          <div className="sales-bg-animation" />
          <div className="sales-bg-animation sales-bg-animation--second" />

          <nav className="sales-nav">
            <a href="#landing-top" className="sales-logo">
              <img src="/aureo-icon.png" alt="Aureo" />
              <span>AUREO OS</span>
            </a>
            <div className="sales-nav-links">
              <a href="#landing-features">Funzionalità</a>
              <a href="#landing-flow">Percorso</a>
              <a href="#landing-pricing">Step</a>
              <a href="#landing-proof">Impatto</a>
            </div>
            <div className="sales-nav-actions">
              <button className="btn btn-outline" onClick={() => setShowLanding(false)}>Accedi</button>
              <button className="btn btn-start" onClick={openPricingSection}>Scopri Aureo</button>
            </div>
          </nav>

          <div className="sales-ticker">
            <div className="sales-ticker-track">
              {[...landingTicker, ...landingTicker].map((item, index) => (
                <div key={`${item.market}-${index}`} className="sales-ticker-item">
                  <span className="sales-ticker-market">{item.market}</span>
                  <span className="sales-ticker-price">{item.price}</span>
                  <span className={`sales-ticker-change sales-ticker-change--${item.direction}`}>{item.change}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sales-page" id="landing-top">
            <section className="sales-hero">
              <div className="sales-hero-content">
                <div className="sales-badge">⚡ Nuovo: AUREO OS Experience</div>
                <h1>
                  Il Futuro della <span>Control Room Operativa</span> è qui
                </h1>
                <p>
                  AUREO OS è l’ambiente premium che unisce dashboard, AI, trading, DeFi e sicurezza in un’esperienza elegante, autorevole e pronta a valorizzare il prodotto fin dal primo sguardo.
                </p>
                                <div className="sales-hero-buttons">
                  <button className="btn btn-start btn-large" onClick={openPricingSection}>
                    Scopri gli step
                  </button>
                  <button className="btn btn-outline btn-large" onClick={startTour}>
                    Guarda il Tour Guidato
                  </button>
                </div>
                <div className="sales-stats-row">
                  {landingStats.map((item) => (
                    <div key={item.value} className="sales-stat-item">
                      <div className="sales-stat-value">{item.value}</div>
                      <div className="sales-stat-label">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sales-hero-visual">
                <div className="sales-phone-mockup">
                  <div className="sales-phone-notch" />
                  <div className="sales-phone-screen">
                    <div className="sales-app-header">
                      <div>
                        <div className="sales-app-title">AUREO OS</div>
                        <div className="sales-app-subtitle">Premium Control Room</div>
                      </div>
                      <div className="sales-app-balance">$100,900</div>
                    </div>
                    <div className="sales-balance-chart">
                      <div className="sales-chart-line" />
                    </div>
                    <div className="sales-bot-status">
                      <span className="sales-status-dot" />
                      <span>Sistema attivo • dashboard, AI e security sincronizzati</span>
                    </div>
                    {[
                      { label: 'AI Guided Investment', meta: 'Segnale live • Budget allocato', value: '+$1,240' },
                      { label: 'DeFi Arbitrage', meta: 'Spread monitorato • 4 venue', value: '+$420' },
                      { label: 'Security Vault', meta: 'Chiavi protette • accesso biometrico', value: 'SAFE' },
                    ].map((item) => (
                      <div key={item.label} className="sales-trade-card">
                        <div className="sales-trade-info">
                          <h4>{item.label}</h4>
                          <span>{item.meta}</span>
                        </div>
                        <div className={`sales-trade-profit ${item.value === 'SAFE' ? 'sales-trade-profit--neutral' : ''}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sales-float-card sales-float-card--top">
                  <div className="sales-float-card-header">Signal confidence</div>
                  <div className="sales-float-card-value">98.2%</div>
                </div>
                <div className="sales-float-card sales-float-card--bottom">
                  <div className="sales-float-card-header">Passkey & secure access</div>
                  <div className="sales-float-card-value sales-float-card-value--alt">Ready</div>
                </div>
                <img src={heroAsset} alt="" className="sales-hero-orb" />
              </div>
            </section>

            <section className="sales-section" id="landing-features">
              <div className="sales-section-header">
                <h2>Tutto ciò che serve per dare peso al prodotto</h2>
                <p>La struttura ora segue molto più da vicino la pagina originale: stessi blocchi, stesso ritmo, identità Aureo.</p>
              </div>
              <div className="sales-features-grid">
                {landingFeatures.map((item) => (
                  <article key={item.title} className="sales-feature-card">
                    <div className="sales-feature-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section sales-section--soft" id="landing-flow">
              <div className="sales-section-header">
                <h2>Inizia in 3 semplici passi</h2>
                <p>Prima percezione, poi scelta, poi accesso: tutto nella stessa esperienza.</p>
              </div>
              <div className="sales-steps-container">
                {landingFlow.map((step) => (
                  <article key={step.number} className="sales-step">
                    <div className="sales-step-number">{step.number}</div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-section" id="landing-pricing">
              <div className="sales-section-header">
                <h2>Scegli lo step perfetto per te</h2>
                <p>Una sezione piani più vicina alla pagina originale, ma con contenuti Aureo e onboarding già collegato.</p>
              </div>
              <div className="sales-pricing-grid">
                {landingPlans.map((plan) => (
                  <article key={plan.id} className={`sales-pricing-card ${plan.id === 'pro' ? 'sales-pricing-card--popular' : ''}`}>
                    {plan.id === 'pro' && <div className="sales-popular-badge">Più richiesto</div>}
                    <div className="sales-pricing-header">
                      <h3>{plan.name}</h3>
                      <div className="sales-price">€{plan.price_monthly}<span>/mese</span></div>
                      <p>{plan.description}</p>
                    </div>
                    <div className="sales-pricing-features">
                      {plan.features.map((feature) => (
                        <div key={feature} className="sales-pricing-feature">✓ {feature}</div>
                      ))}
                    </div>
                    <button className="btn btn-start sales-pricing-button" onClick={() => continueWithPlan(plan.id)}>
                      Continua con {plan.name}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {selectedPlan && (
              <section className="sales-section sales-section--onboarding" id="landing-plan-onboarding">
                <div className="sales-inline-plan">
                  <div className="sales-inline-plan-badge">Percorso selezionato</div>
                  <h3>{selectedPlan.name}</h3>
                  <p>{selectedPlan.description}</p>
                  <div className="sales-inline-plan-price">€{selectedPlan.price_monthly}<span>/mese</span></div>
                  <div className="sales-inline-plan-features">
                    {selectedPlan.features.map((feature) => (
                      <div key={feature} className="sales-inline-plan-feature">✓ {feature}</div>
                    ))}
                  </div>
                </div>

                <form className="sales-inline-form" onSubmit={handleLogin}>
                  <div className="sales-inline-form-head">
                    <div className="sales-badge sales-badge--small">Attivazione guidata</div>
                    <h3>{isRegistering ? `Crea il tuo accesso per ${selectedPlan.name}` : `Accedi per proseguire con ${selectedPlan.name}`}</h3>
                    <p>
                      {isRegistering
                        ? 'Completa qui la registrazione e continua senza uscire dalla pagina.'
                        : 'Se hai già un account, entra qui sotto e prosegui direttamente con lo step scelto.'}
                    </p>
                  </div>
                  <input
                    type="email"
                    placeholder="La tua email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sales-input"
                  />
                  <input
                    type="password"
                    placeholder={isRegistering ? 'Crea una password' : 'Inserisci la tua password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="sales-input"
                  />
                  {loginError && (
                    <div className={`sales-form-message ${loginError.toLowerCase().includes('successo') || loginError.toLowerCase().includes('creato') ? 'sales-form-message--success' : ''}`}>
                      {loginError}
                    </div>
                  )}
                  <button type="submit" className="btn btn-start sales-submit-button">
                    {isRegistering ? `Crea accesso e continua con ${selectedPlan.name}` : `Accedi e continua con ${selectedPlan.name}`}
                  </button>
                  <button type="button" className="btn btn-outline sales-alt-button" onClick={() => setIsRegistering(!isRegistering)}>
                    {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
                  </button>
                  <button
                    type="button"
                    className="btn sales-ghost-button"
                    onClick={() => {
                      setSelectedPlanId('');
                      setIsRegistering(false);
                      setLoginError('');
                      setPassword('');
                      setEmail('');
                    }}
                  >
                    Cambia step
                  </button>
                </form>
              </section>
            )}

            <section className="sales-section sales-section--proof" id="landing-proof">
              <div className="sales-section-header">
                <h2>Recensioni e impressioni</h2>
                <p>Stessa logica della pagina che mi hai dato: prova sociale, autorevolezza e percezione premium.</p>
              </div>
              <div className="sales-testimonials-grid">
                {landingTestimonials.map((item) => (
                  <article key={item.name} className="sales-testimonial-card">
                    <div className="sales-testimonial-header">
                      <div className="sales-testimonial-avatar">{item.initials}</div>
                      <div>
                        <h4>{item.name}</h4>
                        <span>{item.role}</span>
                      </div>
                    </div>
                    <div className="sales-stars">★★★★★</div>
                    <p>{item.quote}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="sales-cta">
              <div className="sales-cta-box">
                <div className="sales-cta-content">
                  <img src="/aureo-logo.jpg" alt="Aureo OS" className="sales-cta-logo" />
                  <h2>Porta l’utente dentro un’esperienza che si fa ricordare</h2>
                  <p>Adesso la landing segue molto più fedelmente il layout originale, ma parla davvero il linguaggio di AUREO OS.</p>
                  <div className="sales-trust-row">
                    {landingTrustPillars.map((item) => (
                      <div key={item} className="sales-trust-pill">{item}</div>
                    ))}
                  </div>
                  <div className="sales-hero-buttons sales-hero-buttons--center">
                    <button className="btn btn-start btn-large" onClick={openPricingSection}>Vedi gli step</button>
                    <button className="btn btn-outline btn-large" onClick={() => setShowLanding(false)}>Accedi ora</button>
                  </div>
                </div>
              </div>
            </section>

            <footer className="sales-footer">
              <div className="sales-footer-grid">
                <div className="sales-footer-brand">
                  <a href="#landing-top" className="sales-logo">
                    <img src="/aureo-icon.png" alt="Aureo" />
                    <span>AUREO OS</span>
                  </a>
                  <p>Dashboard, AI, trading, DeFi e security in un’unica esperienza premium pensata per controllo, chiarezza e presenza.</p>
                </div>
                <div className="sales-footer-links">
                  <h4>Prodotto</h4>
                  <a href="#landing-features">Funzionalità</a>
                  <a href="#landing-pricing">Step</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Esperienza</h4>
                  <a href="#landing-flow">Percorso</a>
                  <a href="#landing-proof">Impatto</a>
                </div>
                <div className="sales-footer-links">
                  <h4>Accesso</h4>
                  <button type="button" className="sales-footer-button" onClick={() => setShowLanding(false)}>Accedi</button>
                  <button type="button" className="sales-footer-button" onClick={openPricingSection}>Scegli piano</button>
                </div>
              </div>
              <div className="sales-footer-bottom">
                <span>© 2026 AUREO OS</span>
                <span>Premium crypto & investment experience</span>
              </div>
            </footer>
          </div>
        </div>
      );
    }

    return (
      <div className="omni-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', width: '400px', padding: '3rem 2rem' }}>
          <img src="/aureo-logo.jpg" alt="AUREO" style={{ maxWidth: '100%', maxHeight: '140px', marginBottom: '1.5rem', objectFit: 'contain' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Ponte di Comando Autenticato</p>
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder={isRegistering ? "La tua Email" : "Email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <input 
              type="password" 
              placeholder={isRegistering ? "Crea una Password" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            {loginError && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
              {isRegistering ? 'CREA ACCOUNT' : 'ACCEDI'}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsRegistering(!isRegistering)}
            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem' }}
          >
            {isRegistering ? 'HAI GIÀ UN ACCOUNT? ACCEDI' : 'NON HAI UN ACCOUNT? REGISTRATI'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handlePasskeyLogin}
            disabled={!passkeySupported || passkeyBusy || isRegistering}
            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: (passkeySupported && !isRegistering) ? 1 : 0.3 }}
          >
            {passkeyBusy ? 'Accesso biometrico…' : 'ACCEDI CON FACE ID / TOUCH ID'}
          </button>
          <button type="button" className="btn btn-outline" onClick={enterDemoMode} style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: isRegistering ? 0.3 : 1 }}>
            ENTRA IN DEMO MODE
          </button>
          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
            🔒 Protetto da Crittografia<br/>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERFACCIA AUTENTICATA (ADMIN O USER ATTIVO) ---
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
            <span className="menu-icon">📊</span>
            <span className="menu-label">Dashboard</span>
          </div>
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span>
            <span className="menu-label">Trading</span>
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
            <span className="menu-icon">⛓️</span>
            <span className="menu-label">DeFi</span>
            {status.modules?.crypto_arb && <div className="active-dot"></div>}
          </div>
          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="menu-icon">🔐</span>
            <span className="menu-label">Security</span>
          </div>
          {BILLING_ENABLED && userRole === 'admin' && (
            <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
              <span className="menu-icon">💳</span>
              <span className="menu-label">Billing</span>
            </div>
          )}
          <div className={`menu-item ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
            <span className="menu-icon">📖</span>
            <span className="menu-label">Guida Setup</span>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div>Connesso a server sicuro</div>
          <div style={{ color: '#10b981', marginTop: '0.2rem' }}>All Systems Nominal</div>
          <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
          
          {userRole === 'user' && (
            <button className="btn btn-start" onClick={() => setShowPaymentModal(true)} style={{ width: '100%', marginTop: '1rem', fontSize: '1rem', padding: '0.8rem', background: userIsPaid ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)', border: 'none', boxShadow: userIsPaid ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
              {userIsPaid ? '♻️ Rinnova Abbonamento' : '💎 Sblocca Pro / Paga'}
            </button>
          )}

          <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            👤 {email}
          </div>

          <button
            onClick={handleLogout}
            className="btn"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            LOGOUT
          </button>
        </div>
        

      </div>
      
      <div className="main-content">
        {/* Onboarding Modal */}
        {showOnboarding && (
          <OnboardingModal 
            onClose={() => setShowOnboarding(false)} 
            onGoToSettings={() => {
              setShowOnboarding(false);
              setActiveTab('settings');
            }}
          />
        )}

        {/* Missing Keys Banner */}
        {(!apiKeys.alpaca_key && !apiKeys.binance_key && userRole !== 'admin' && !isDemoMode) && (
          <div style={{
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
          }}>
            <div>
              <strong>Azione Richiesta:</strong> Configura le tue API Key per iniziare a operare sui mercati.
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              style={{
                background: '#fff', color: '#d97706', border: 'none', padding: '0.5rem 1rem',
                borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Vai alle Impostazioni →
            </button>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
              {renderCryptoPaywall()}
            </div>
          </div>
        )}

        {isDemoMode && (
          <div className="demo-mode-banner">
            Demo mode attiva — puoi esplorare il prodotto, ma le azioni live sono bloccate.
          </div>
        )}
        <div className="mobile-shell-header">
          <div>
            <div className="mobile-shell-kicker">AUREO OS</div>
            <div className="mobile-shell-title">{activeTabLabel}</div>
            {isDemoMode && <div className="demo-mode-pill">DEMO MODE</div>}
            <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
          </div>
          <button onClick={handleLogout} className="btn mobile-shell-action">
            Logout
          </button>
        </div>
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'settings' && renderSettingsView()}
        {activeTab === 'trading' && renderTradingView()}
        {activeTab === 'crypto_arb' && renderArbitrageView()}
        {activeTab === 'sports_arb' && renderSportsArbitrageView()}
        {activeTab === 'value_bets' && renderValueBetsView()}
        {activeTab === 'ai_content' && renderAIContentView()}
        {BILLING_ENABLED && activeTab === 'saas' && renderSaaSView()}
        {activeTab === 'guide' && renderGuideView()}
      </div>
    </div>

    {/* ===== AI SIGNAL MODAL ===== */}
    {aiModal && (
      <div
        onClick={() => setAiModal(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px', padding: '2rem', width: '420px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative'
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setAiModal(null)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}
          >×</button>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem' }}>🤖</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.3rem', color: '#f59e0b' }}>{aiModal.symbol}</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Analisi AI – Groq LLaMA</div>
            </div>
          </div>

          {/* Context row */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Prezzo</div>
              <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 'bold' }}>
                ${aiModal.price < 0.01 ? aiModal.price.toFixed(8) : aiModal.price < 1 ? aiModal.price.toFixed(6) : aiModal.price.toFixed(4)}
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Var 24h</div>
              <div style={{ color: aiModal.change_24h >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {aiModal.change_24h >= 0 ? '+' : ''}{aiModal.change_24h?.toFixed(2)}%
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Volatilità</div>
              <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 'bold' }}>{aiModal.volatility?.toFixed(1)}%</div>
            </div>
          </div>

          {/* Loading state */}
          {aiModal.loading && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#f59e0b' }}>
              <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
              <div style={{ marginTop: '0.8rem', color: '#94a3b8' }}>LLaMA sta analizzando il mercato...</div>
            </div>
          )}

          {/* Error state */}
          {!aiModal.loading && aiModal.error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '10px', padding: '1rem', color: '#f87171', textAlign: 'center' }}>
              ❌ {aiModal.error}
            </div>
          )}

          {/* Result state */}
          {!aiModal.loading && aiModal.result && (() => {
            const r = aiModal.result;
            const signalColor = r.signal === 'BUY' ? '#10b981' : r.signal === 'SELL' ? '#ef4444' : '#f59e0b';
            const signalBg = r.signal === 'BUY' ? 'rgba(16,185,129,0.15)' : r.signal === 'SELL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
            const signalEmoji = r.signal === 'BUY' ? '📈' : r.signal === 'SELL' ? '📉' : '⏸️';
            return (
              <>
                {/* Signal badge */}
                <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                  <div style={{ background: signalBg, border: `2px solid ${signalColor}`, borderRadius: '14px', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 2rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>{signalEmoji}</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: signalColor, letterSpacing: '2px' }}>{r.signal}</span>
                  </div>
                  <div style={{ color: r.confidence >= 80 ? '#10b981' : r.confidence >= 50 ? '#f59e0b' : '#ef4444', marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {r.confidence}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Confidence Score AI</div>
                </div>

                {/* Reasoning */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '1rem', marginBottom: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  💡 {r.reasoning}
                </div>

                {/* Price targets */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '1.2rem' }}>
                  <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '0.7rem', textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🎯 Target</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <HighRiskPnLSparkline history={r.price_history} />
                      <div style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 'bold' }}>${Number(r.target_price).toFixed(r.target_price < 0.01 ? 8 : r.target_price < 1 ? 6 : 4)}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.7rem', textAlign: 'center' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🛡️ Stop Loss</div>
                    <div style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 'bold' }}>${Number(r.stop_loss).toFixed(r.stop_loss < 0.01 ? 8 : r.stop_loss < 1 ? 6 : 4)}</div>
                  </div>
                </div>

                {/* Quick trade from modal */}
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <button
                    onClick={() => { quickTrade(aiModal.symbol, 'buy', tradeSize); setAiModal(null); }}
                    disabled={isDemoMode}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDemoMode ? 0.5 : 1 }}
                  >⬆ BUY ${tradeSize}</button>
                  <button
                    onClick={() => { quickTrade(aiModal.symbol, 'sell', tradeSize); setAiModal(null); }}
                    disabled={isDemoMode}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDemoMode ? 0.5 : 1 }}
                  >⬇ SELL ${tradeSize}</button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    )}
  </ErrorBoundary>
  );
}

export default OmniApp;
