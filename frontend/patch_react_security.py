import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add isAuthenticated state
if "const [isAuthenticated, setIsAuthenticated] = useState" not in content:
    content = content.replace("const [activeTab, setActiveTab] = useState('home');", "const [isAuthenticated, setIsAuthenticated] = useState(false);\n  const [password, setPassword] = useState('');\n  const [loginError, setLoginError] = useState('');\n  const [activeTab, setActiveTab] = useState('home');")

# 2. Add Keys state
if "const [apiKeys, setApiKeys] = useState" not in content:
    content = content.replace("const [status, setStatus] = useState({});", "const [status, setStatus] = useState({});\n  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', binance_key:'', binance_secret:'', kraken_key:'', kraken_secret:'', elevenlabs_key:'', theodds_key:''});\n  const [testResults, setTestResults] = useState({});")

# 3. Add Login Function
login_fn = """
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
        setLoginError('');
      } else {
        setLoginError('Accesso Negato: Password Errata');
      }
    } catch (err) {
      setLoginError('Errore di connessione al server');
    }
  };
"""
if "const handleLogin" not in content:
    content = content.replace("const toggleModule", login_fn + "\n  const toggleModule")

# 4. Add renderLoginView
render_login = """
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', width: '400px' }}>
          <h1 style={{ fontSize: '2rem', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>OMNI-PROFIT V2</h1>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Ponte di Comando Autenticato</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="Inserisci Master Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px', color: '#fff', fontSize: '1rem', marginBottom: '1rem', outline: 'none' }}
            />
            {loginError && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            <button type="submit" style={{ width: '100%', padding: '1rem', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>ACCEDI ALL'IMPERO</button>
          </form>
          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
            🔒 Protetto da Crittografia<br/>
            {/* TODO: In futuro aggiungere supporto per Authenticator App (MFA) come richiesto dall'utente */}
          </div>
        </div>
      </div>
    );
  }
"""
if "if (!isAuthenticated)" not in content:
    content = content.replace("return (\n  <ErrorBoundary>\n    <div className=\"omni-app\">", render_login + "\n  return (\n  <ErrorBoundary>\n    <div className=\"omni-app\">")

# 5. Add renderSettingsView
render_settings = """
  const testConnection = async (service) => {
    setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service})
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
      alert('Chiavi salvate con successo nel Vault Sicuro!');
    } catch(err) {
      alert('Errore durante il salvataggio');
    }
  };

  const renderSettingsView = () => (
    <div className="module-content">
      <div className="header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>🔐 Security & API Vault</h2>
        <div style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Gestione chiavi crittografate per le connessioni ai mercati reali.</div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Alpaca (Stock Market)</h3>
          <button onClick={() => testConnection('alpaca')} style={{ background: 'transparent', border: '1px solid #06b6d4', color: '#06b6d4', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.alpaca_key} onChange={e => setApiKeys({...apiKeys, alpaca_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.alpaca_secret} onChange={e => setApiKeys({...apiKeys, alpaca_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['alpaca'] && <div style={{ color: testResults['alpaca'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['alpaca']}</div>}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Binance (Crypto Arb)</h3>
          <button onClick={() => testConnection('binance')} style={{ background: 'transparent', border: '1px solid #06b6d4', color: '#06b6d4', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Test Connessione</button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="password" placeholder="API Key" value={apiKeys.binance_key} onChange={e => setApiKeys({...apiKeys, binance_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          <input type="password" placeholder="Secret Key" value={apiKeys.binance_secret} onChange={e => setApiKeys({...apiKeys, binance_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        {testResults['binance'] && <div style={{ color: testResults['binance'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['binance']}</div>}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0' }}>Altri Servizi</h3>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>ElevenLabs API (Generazione Voce TikTok)</label>
            <input type="password" placeholder="ElevenLabs API Key" value={apiKeys.elevenlabs_key} onChange={e => setApiKeys({...apiKeys, elevenlabs_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>The-Odds-API (Sports SureBets)</label>
            <input type="password" placeholder="The-Odds-API Key" value={apiKeys.theodds_key} onChange={e => setApiKeys({...apiKeys, theodds_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={saveKeys} style={{ background: '#10b981', color: '#000', padding: '1rem 3rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Salva nel Vault Sicuro</button>
      </div>
    </div>
  );
"""
if "const renderSettingsView" not in content:
    content = content.replace("const renderHomeView =", render_settings + "\n  const renderHomeView =")

# 6. Add Settings tab to Sidebar
old_sidebar = """          <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
            <span className="menu-icon">💳</span> SaaS & Billing
          </div>
        </div>"""
new_sidebar = """          <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
            <span className="menu-icon">💳</span> SaaS & Billing
          </div>
          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="menu-icon">🔐</span> Security & API
          </div>
        </div>"""
if "Security & API" not in content:
    content = content.replace(old_sidebar, new_sidebar)

# 7. Add rendering of settings to main-content
old_main = """      <div className="main-content">
        {activeTab === 'home' && renderHomeView()}"""
new_main = """      <div className="main-content">
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'settings' && renderSettingsView()}"""
if "activeTab === 'settings'" not in content:
    content = content.replace(old_main, new_main)

with open(file_path, 'w') as f:
    f.write(content)

print("React UI patched with Security and Login.")
