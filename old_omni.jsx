commit c44cc34433b2c0493320c1a635dd1295a82de5fa
Author: Max Morrison <maxmorrison@gmail.com>
Date:   Tue Jul 7 21:09:43 2026 +0200

    Remove DeFi Arbitrage module

diff --git a/frontend/src/OmniApp.jsx b/frontend/src/OmniApp.jsx
index 53d31b5..17257a2 100644
--- a/frontend/src/OmniApp.jsx
+++ b/frontend/src/OmniApp.jsx
@@ -8,7 +8,6 @@ const BILLING_ENABLED = true;
 const TAB_TITLES = {
   home: 'Dashboard',
   trading: 'Stock Market',
-  crypto_arb: 'DeFi Arbitrage',
   sports_arb: 'Sports SureBets',
   value_bets: 'AI Sentiment',
   ai_content: 'AI Content',
@@ -44,7 +43,7 @@ const DEMO_BILLING_OVERVIEW = {
       currency: 'EUR',
       description: 'Per utenti che vogliono automazioni, segnali e moduli avanzati.',
       features: ['Tutti i moduli core', 'Alert operativi', '3 workspace', 'Priority support'],
-      modules: ['dashboard', 'trading', 'defi', 'sentiment'],
+      modules: ['dashboard', 'trading', 'sentiment'],
       checkout_url: 'https://buy.stripe.com/test_pro',
     },
     {
@@ -54,7 +53,7 @@ const DEMO_BILLING_OVERVIEW = {
       currency: 'EUR',
       description: 'Per desk, consulenti e clienti ad alto valore con onboarding guidato.',
       features: ['White-glove onboarding', 'Utenti multipli', 'Billing priority', 'Canale dedicato'],
-      modules: ['dashboard', 'trading', 'defi', 'sentiment', 'ai_content', 'billing'],
+      modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing'],
       checkout_url: 'https://buy.stripe.com/test_elite',
     },
   ],
@@ -318,27 +317,9 @@ const OnboardingModal = ({ onClose, onGoToSettings }) => {
             }}>Apri un account Alpaca ↗</a>
           </div>
 
-          {/* Binance/Kraken */}
-          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
-            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#f59e0b' }}>2. Trading Crypto (Binance o Kraken)</h3>
-            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
-              Per il trading ad alta frequenza sulle crypto, suggeriamo Binance o Kraken.<br/>
-              <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida Binance:</strong> Profilo {'>'} API Management {'>'} Create API. <br/>
-              <strong>Guida Kraken:</strong> Profilo {'>'} Sicurezza {'>'} API {'>'} Aggiungi chiave. Attendi 24h se l'account è nuovo.</span>
-            </p>
-            <div style={{ display: 'flex', gap: '1rem' }}>
-              <a href="https://www.binance.com/" target="_blank" rel="noopener noreferrer" style={{
-                display: 'inline-block', background: '#f59e0b', color: '#000', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
-              }}>Binance ↗</a>
-              <a href="https://www.kraken.com/" target="_blank" rel="noopener noreferrer" style={{
-                display: 'inline-block', background: '#5841D8', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none'
-              }}>Kraken ↗</a>
-            </div>
-          </div>
-
           {/* Groq */}
           <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
-            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#a78bfa' }}>3. Intelligenza Artificiale (Groq)</h3>
+            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#a78bfa' }}>2. Intelligenza Artificiale (Groq)</h3>
             <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
               Il motore AI alla base delle decisioni di trading ultrarapide.<br/>
               <span style={{opacity: 0.8, fontSize: '0.85rem'}}><strong>Guida:</strong> Accedi alla console di Groq, vai su "API Keys" nel menu a sinistra e clicca su "Create API Key". Copiala sùbito perché non potrai visualizzarla di nuovo.</span>
@@ -370,7 +351,7 @@ function OmniApp() {
   
   const [numValueBets, setNumValueBets] = useState(9);
   const [placedBets, setPlacedBets] = useState({});
-  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', binance_key:'', binance_secret:'', kraken_key:'', kraken_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:''});
+  const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:''});
   const [testResults, setTestResults] = useState({});
   const [savedKeys, setSavedKeys] = useState({});
   const [timeframe, setTimeframe] = useState('1D');
@@ -393,11 +374,6 @@ function OmniApp() {
   const [isAiLoading, setIsAiLoading] = useState(false);
   const [executionMessage, setExecutionMessage] = useState("");
 
-  // High Risk Quick Scalping state
-  const [tradeSize, setTradeSize] = useState(100);
-  const [tradeResult, setTradeResult] = useState(null);
-  const [aiModal, setAiModal] = useState(null); // null | { symbol, price, volatility, change_24h, loading, result, error }
-
   // Manual Stock Trading state
   const [manualSymbol, setManualSymbol] = useState("");
   const [manualAmount, setManualAmount] = useState(100);
@@ -520,46 +496,6 @@ function OmniApp() {
     setManualLoading(false);
   };
 
-  const openAiSignal = async (asset) => {
-    setAiModal({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h, loading: true, result: null, error: null });
-    try {
-      const res = await authFetch('/api/high-risk/ai-signal', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ symbol: asset.symbol, price: asset.price, volatility: asset.volatility, change_24h: asset.change_24h })
-      });
-      const data = await res.json();
-      if (data.error) {
-        setAiModal(prev => ({ ...prev, loading: false, error: data.error }));
-      } else {
-        setAiModal(prev => ({ ...prev, loading: false, result: data }));
-      }
-    } catch (e) {
-      setAiModal(prev => ({ ...prev, loading: false, error: 'Errore di rete: ' + e.message }));
-    }
-  };
-
-  const quickTrade = async (symbol, side, amount) => {
-    setTradeResult(null);
-    try {
-      const res = await authFetch('/api/high-risk/trade', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ symbol, side, amount })
-      });
-      const data = await res.json();
-      setTradeResult(data);
-      // Aggiorna il saldo virtuale nel context locale
-      if (!data.error && data.virtual_cash !== undefined) {
-        setStatus(prev => ({ ...prev, cash: data.virtual_cash }));
-      }
-      // Cancella il messaggio dopo 5 secondi
-      setTimeout(() => setTradeResult(null), 5000);
-    } catch (e) {
-      setTradeResult({ error: 'Errore di rete: ' + e.message });
-    }
-  };
-
   const checkAuthMemory = () => {
     const authTime = localStorage.getItem(AUTH_TIME_KEY);
     const authToken = getAuthToken();
@@ -594,11 +530,6 @@ function OmniApp() {
       title: 'Trading Manuale & AI',
       text: 'Qui puoi seguire i segnali operativi guidati dall\'Intelligenza Artificiale, analizzare i grafici e impostare operazioni sia manuali che ad alta frequenza.'
     },
-    {
-      targetTab: 'crypto_arb',
-      title: 'Arbitraggio DeFi',
-      text: 'Il modulo Arbitraggio analizza centinaia di pool di liquidità decentralizzate per farti capitalizzare gli spread in millisecondi.'
-    },
     {
       targetTab: 'value_bets',
       title: 'AI Sentiment & Value Bets',
@@ -620,24 +551,6 @@ function OmniApp() {
     setActiveTab(TOUR_STEPS[0].targetTab);
   };
 
-  const nextTourStep = () => {
-    if (tourStep < TOUR_STEPS.length - 1) {
-      const nextStep = tourStep + 1;
-      setTourStep(nextStep);
-      setActiveTab(TOUR_STEPS[nextStep].targetTab);
-    } else {
-      endTour();
-    }
-  };
-
-  const prevTourStep = () => {
-    if (tourStep > 0) {
-      const prevStep = tourStep - 1;
-      setTourStep(prevStep);
-      setActiveTab(TOUR_STEPS[prevStep].targetTab);
-    }
-  };
-
   const endTour = () => {
     setIsTourActive(false);
     setIsDemoMode(false);
@@ -765,7 +678,6 @@ function OmniApp() {
     setLoginError('');
     setPasskeyMessage('');
     setActiveTab('home');
-    // Fetch payment status and check onboarding for user (non-blocking)
     setTimeout(async () => {
       try {
         const res = await authFetch('/api/user/me');
@@ -778,7 +690,7 @@ function OmniApp() {
           const keysRes = await authFetch('/api/keys');
           if (keysRes.ok) {
             const keysData = await keysRes.json();
-            if (!keysData.ALPACA_KEY && !keysData.BINANCE_KEY) {
+            if (!keysData.ALPACA_KEY) {
               setShowOnboarding(true);
             }
           }
@@ -850,7 +762,6 @@ function OmniApp() {
         });
         const data = await res.json();
         if (res.ok && data.status === 'success') {
-          // Auto-login after successful registration
           const loginRes = await fetch('/api/login', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ email, password })
@@ -858,7 +769,6 @@ function OmniApp() {
           const loginData = await loginRes.json();
           if (loginRes.ok) {
             completeAuthenticatedSession(loginData.token, loginData.role, loginData.user_status);
-            // Show paywall immediately to prompt payment
             setShowPaymentModal(true);
           } else {
             setLoginError('Registrazione ok, ma login automatico fallito. Riprova.');
@@ -867,7 +777,6 @@ function OmniApp() {
           setLoginError(data.detail || 'Errore durante la registrazione');
         }
       } else {
-        // Modalità Login (se email è vuoto entra come admin)
         const payload = email ? { email, password } : { password };
         const res = await fetch('/api/login', {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
@@ -1028,85 +937,13 @@ function OmniApp() {
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ module: mod_id, active: !isActive })
       });
-      // Il polling da 2 secondi rileverà automaticamente il nuovo stato
-    } catch (err) {
-      console.error(err);
-    }
-  };
-
-  const generateAiProposals = async (strategy = 'balanced') => {
-    setIsAiLoading(true);
-    setExecutionMessage("");
-    setAiProposals([]);
-    try {
-      const res = await fetch('/api/ai-invest/proposals', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ budget: Number(aiBudget), strategy })
-      });
-      const data = await res.json();
-      if (data.proposals) {
-        setAiProposals(data.proposals);
-      } else {
-        setExecutionMessage(data.detail || "Errore sconosciuto");
-      }
-    } catch (err) {
-      console.error(err);
-      setExecutionMessage("Errore di connessione al server.");
-    }
-    setIsAiLoading(false);
-  };
-
-  const cancelAiInvestment = async (index, symbol, platform) => {
-    if(!window.confirm(`Vuoi davvero annullare l'ordine su ${symbol}?`)) return;
-    try {
-      const res = await authFetch('/api/ai-invest/cancel', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ index, symbol, platform })
-      });
-      const data = await res.json();
-      if (res.ok) {
-        alert(data.message);
-        // Forza refresh stato
-        fetch('/api/status', {
-          headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
-        }).then(r => r.json()).then(d => { if(!d.error) setStatus(d); });
-      } else {
-        alert(data.detail || 'Errore durante la cancellazione');
-      }
-    } catch (e) {
-      alert('Errore di rete');
-    }
-  };
-
-  const executeAiProposal = async (proposal) => {
-    setExecutionMessage(`Esecuzione in corso per ${proposal.symbol}...`);
-    try {
-      const res = await authFetch('/api/ai-invest/execute', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({
-          symbol: proposal.symbol,
-          asset_type: proposal.asset_type,
-          amount_usd: Number(aiBudget)
-        })
-      });
-      const data = await res.json();
-      if (res.ok) {
-        setExecutionMessage(`✅ ${data.message}`);
-        // Aggiorna lo stato del portafoglio forzando il refetch (sarà gestito dal polling)
-      } else {
-        setExecutionMessage(`❌ Errore: ${data.detail}`);
-      }
     } catch (err) {
       console.error(err);
-      setExecutionMessage("❌ Errore di rete durante l'esecuzione.");
     }
   };
 
   const placeBet = async (sb) => {
-    if (placedBets[sb.id]) return; // già piazzata
+    if (placedBets[sb.id]) return;
     setPlacedBets(prev => ({ ...prev, [sb.id]: 'loading' }));
     try {
       const res = await authFetch('/api/place-bet', {
@@ -1144,9 +981,6 @@ function OmniApp() {
       }
     }
   };
-
-  // Rendering Helper per Trading
-  
   
   const testConnection = async (service) => {
     setTestResults(prev => ({...prev, [service]: 'Test in corso...'}));
@@ -1173,7 +1007,6 @@ function OmniApp() {
         throw new Error(resData.detail || 'Errore sconosciuto dal server');
       }
       alert('Chiavi salvate con successo nel Vault Sicuro!');
-      // Refetch keys immediately so dots appear
       const refetchRes = await authFetch('/api/keys');
       const data = await refetchRes.json();
       setSavedKeys(data);
@@ -1197,15 +1030,10 @@ function OmniApp() {
             alert("Errore critico dal backend nel leggere le chiavi: " + data.ERROR);
           }
           setSavedKeys(data);
-          // PRE-POPULATE I CAMPI DI TESTO CON I PALLINI (o la stringa mascherata)
           setApiKeys(prev => ({
             ...prev,
             alpaca_key: data.ALPACA_KEY || '',
             alpaca_secret: data.ALPACA_SECRET || '',
-            binance_key: data.BINANCE_KEY || '',
-            binance_secret: data.BINANCE_SECRET || '',
-            kraken_key: data.KRAKEN_KEY || '',
-            kraken_secret: data.KRAKEN_SECRET || '',
             elevenlabs_key: data.ELEVENLABS_KEY || '',
             theodds_key: data.THEODDS_KEY || '',
             groq_key: data.GROQ_KEY || '',
@@ -1258,7 +1086,7 @@ function OmniApp() {
           const res = await authFetch('/api/keys');
           if (res.ok) {
             const data = await res.json();
-            if (!data.ALPACA_KEY && !data.BINANCE_KEY && !data.KRAKEN_KEY) {
+            if (!data.ALPACA_KEY) {
               setShowOnboarding(true);
             }
           }
@@ -1268,67 +1096,6 @@ function OmniApp() {
     }
   }, [isAuthenticated, isDemoMode, userRole]);
 
-  const copyCheckoutLink = async (url) => {
-    try {
-      await navigator.clipboard.writeText(url);
-      setBillingMessage('Link checkout copiato negli appunti');
-    } catch {
-      setBillingMessage('Copia non riuscita, copia il link manualmente');
-    }
-  };
-
-  const createBillingLead = async () => {
-    if (isDemoMode) {
-      setBillingMessage('Demo mode: creazione lead disabilitata');
-      return;
-    }
-    setBillingMessage('');
-    setBillingLoading(true);
-    try {
-      const res = await authFetch('/api/saas/lead', {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify(billingLead),
-      });
-      const data = await res.json();
-      if (res.ok) {
-        setBillingOverview(data.overview);
-        setBillingLead({ company: '', contact_name: '', email: '', plan_id: billingLead.plan_id, seats: 1 });
-        setBillingMessage('Lead creato con successo');
-      } else {
-        setBillingMessage(data.detail || 'Errore creazione lead');
-      }
-    } catch {
-      setBillingMessage('Errore di rete durante la creazione del lead');
-    }
-    setBillingLoading(false);
-  };
-
-  const updateBillingStatus = async (recordId, statusValue) => {
-    if (isDemoMode) {
-      setBillingMessage('Demo mode: aggiornamento stato disabilitato');
-      return;
-    }
-    setBillingLoading(true);
-    try {
-      const res = await authFetch(`/api/saas/customer/${recordId}/status`, {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ status: statusValue }),
-      });
-      const data = await res.json();
-      if (res.ok) {
-        setBillingOverview(data.overview);
-        setBillingMessage(`Stato aggiornato a ${statusValue.toUpperCase()}`);
-      } else {
-        setBillingMessage(data.detail || 'Errore aggiornamento stato');
-      }
-    } catch {
-      setBillingMessage('Errore di rete durante l’aggiornamento');
-    }
-    setBillingLoading(false);
-  };
-
   const renderGuideView = () => {
     const platforms = [
       {
@@ -1350,46 +1117,6 @@ function OmniApp() {
         ],
         note: 'Il Paper Trading è completamente gratuito e simula operazioni reali senza rischi.',
       },
-      {
-        id: 'binance',
-        name: 'Binance',
-        subtitle: 'Crypto Arbitrage',
-        icon: '🟡',
-        color: '#eab308',
-        bg: 'rgba(234, 179, 8, 0.08)',
-        border: 'rgba(234, 179, 8, 0.25)',
-        url: 'https://www.binance.com',
-        keyPresent: savedKeys['BINANCE_KEY'],
-        steps: [
-          { n: 1, text: 'Vai su binance.com → Registrati con email' },
-          { n: 2, text: 'Completa la verifica identità (KYC) — richiede documento' },
-          { n: 3, text: 'Profilo → Gestione API → Crea nuova API Key' },
-          { n: 4, text: 'Permessi: abilita "Lettura" + "Trading Spot". Lascia DISABILITATO "Prelievi"' },
-          { n: 5, text: 'Copia "API Key" e "Secret Key"' },
-          { n: 6, text: 'Torna su Aureo OS → Security → incolla in "Binance"' },
-        ],
-        note: '⚠️ Non abilitare mai i permessi di prelievo sulle API Key per sicurezza.',
-      },
-      {
-        id: 'kraken',
-        name: 'Kraken',
-        subtitle: 'Crypto Arbitrage (secondo exchange)',
-        icon: '🦑',
-        color: '#8b5cf6',
-        bg: 'rgba(139, 92, 246, 0.08)',
-        border: 'rgba(139, 92, 246, 0.25)',
-        url: 'https://www.kraken.com',
-        keyPresent: savedKeys['KRAKEN_KEY'],
-        steps: [
-          { n: 1, text: 'Vai su kraken.com → Registrati' },
-          { n: 2, text: 'Completa la verifica base (email + telefono)' },
-          { n: 3, text: 'Sicurezza → API Keys → Genera nuova chiave' },
-          { n: 4, text: 'Permessi: seleziona "Query Funds" + "Create & Modify Orders"' },
-          { n: 5, text: 'Copia "API Key" e "Private Key"' },
-          { n: 6, text: 'Torna su Aureo OS → Security → incolla in "Kraken"' },
-        ],
-        note: 'Kraken è usato in combinazione con Binance per rilevare opportunità di arbitraggio.',
-      },
       {
         id: 'groq',
         name: 'Groq AI',
@@ -1423,7 +1150,6 @@ function OmniApp() {
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
           {platforms.map(platform => (
             <div key={platform.id} className="card" style={{ border: `1px solid ${platform.border}`, background: platform.bg, padding: '1.5rem' }}>
-              {/* Header */}
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <span style={{ fontSize: '2rem' }}>{platform.icon}</span>
@@ -1443,7 +1169,6 @@ function OmniApp() {
                 </div>
               </div>
 
-              {/* Steps */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                 {platform.steps.map(step => (
                   <div key={step.n} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
@@ -1455,12 +1180,10 @@ function OmniApp() {
                 ))}
               </div>
 
-              {/* Note */}
               <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
                 💡 {platform.note}
               </div>
 
-              {/* CTA */}
               <button
                 className="btn btn-outline"
                 onClick={() => setActiveTab('settings')}
@@ -1471,25 +1194,6 @@ function OmniApp() {
             </div>
           ))}
         </div>
-
-        {/* Bottom tip */}
-        <div className="card" style={{ marginTop: '2rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '1.5rem' }}>
-          <h3 style={{ color: '#10b981', marginBottom: '0.8rem' }}>✅ Ordine consigliato per iniziare</h3>
-          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
-            {[
-              { n: 1, icon: '🤖', name: 'Groq AI', desc: 'Prima cosa — gratuito e immediato' },
-              { n: 2, icon: '🦙', name: 'Alpaca', desc: 'Paper trading gratuito — zero rischi' },
-              { n: 3, icon: '🟡', name: 'Binance', desc: 'Crypto arb (richiede KYC)' },
-              { n: 4, icon: '🦑', name: 'Kraken', desc: 'Secondo exchange per arb' },
-            ].map(item => (
-              <div key={item.n} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
-                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{item.icon}</div>
-                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>Step {item.n}: {item.name}</div>
-                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.desc}</div>
-              </div>
-            ))}
-          </div>
-        </div>
       </div>
     );
   };
@@ -1550,30 +1254,6 @@ function OmniApp() {
         {testResults['alpaca'] && <div style={{ color: testResults['alpaca'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['alpaca']}</div>}
       </div>
 
-      <div className="card" style={{ marginBottom: '2rem' }}>
-        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
-          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Binance (Crypto Arb) {savedKeys['BINANCE_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
-          <button onClick={() => testConnection('binance')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
-        </div>
-        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
-          <input type="password" placeholder="API Key" value={apiKeys.binance_key} onChange={e => setApiKeys({...apiKeys, binance_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
-          <input type="password" placeholder="Secret Key" value={apiKeys.binance_secret} onChange={e => setApiKeys({...apiKeys, binance_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
-        </div>
-        {testResults['binance'] && <div style={{ color: testResults['binance'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['binance']}</div>}
-      </div>
-
-      <div className="card" style={{ marginBottom: '2rem' }}>
-        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
-          <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Kraken (Crypto Arb) {savedKeys['KRAKEN_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
-          <button onClick={() => testConnection('kraken')} className="btn" {...demoActionButtonProps()} style={{ padding: '0.5rem 1rem', ...demoActionStyle }}>Test Connessione</button>
-        </div>
-        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
-          <input type="password" placeholder="API Key" value={apiKeys.kraken_key} onChange={e => setApiKeys({...apiKeys, kraken_key: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
-          <input type="password" placeholder="Secret Key" value={apiKeys.kraken_secret} onChange={e => setApiKeys({...apiKeys, kraken_secret: e.target.value})} style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
-        </div>
-        {testResults['kraken'] && <div style={{ color: testResults['kraken'].includes('success') ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}>{testResults['kraken']}</div>}
-      </div>
-
       <div className="card" style={{ marginBottom: '2rem' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
           <h3 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>Groq AI (Sentiment & Investments) {savedKeys['GROQ_KEY'] ? <span style={{ color: '#10b981', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span>Presente</span> : <span style={{ color: '#ef4444', marginLeft: '0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>Assente</span>}</h3>
@@ -1600,7 +1280,6 @@ function OmniApp() {
     const pieData = [
       { name: 'Liquidità', value: virtualCash, color: 'var(--text-secondary)' },
       { name: 'Azioni (Trading)', value: Math.abs(tradingProfit) || 100, color: '#38bdf8' },
-      { name: 'Crypto Arbitrage', value: status.modules?.crypto_arb ? 120.50 : 0, color: '#10b981' }
     ].filter(item => item.value > 0);
 
     return (
@@ -1614,13 +1293,12 @@ function OmniApp() {
           <div className="onboarding-banner" style={{ background: 'linear-gradient(90deg, #ef4444, #b91c1c)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
               <h3 style={{ margin: '0 0 0.5rem 0' }}>⚠️ Broker non collegato</h3>
-              <p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca/Binance.</p>
+              <p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca.</p>
             </div>
             <button onClick={() => setActiveTab('settings')} className="btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>Collega ora ➔</button>
           </div>
         )}
 
-        {/* Big Number */}
         <div className="hero-summary" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center', marginBottom: '2rem' }}>
           <div className="hero-summary-label" style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
           <div className="hero-summary-value" style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
@@ -1629,7 +1307,6 @@ function OmniApp() {
         </div>
 
         <div className="dashboard-grid">
-          {/* Pie Chart Asset Allocation */}
           <div className="card col-span-6">
             <h3 className="card-title">Asset Allocation</h3>
             <div style={{ height: '300px' }}>
@@ -1647,7 +1324,6 @@ function OmniApp() {
             </div>
           </div>
 
-          {/* Leaderboard Moduli */}
           <div className="card col-span-6">
             <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>🏆 Leaderboard Moduli</h3>
             
@@ -1663,18 +1339,6 @@ function OmniApp() {
                 <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${Math.abs(tradingProfit).toFixed(2)}</div>
               </div>
 
-
-
-              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
-                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
-                  <span style={{ fontSize: '1.5rem' }}>🥈</span>
-                  <div>
-                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>DeFi Arbitrage</div>
-                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spread</div>
-                  </div>
-                </div>
-                <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${status.modules?.crypto_arb ? '120.50' : '0.00'}</div>
-              </div>
             </div>
           </div>
         </div>
@@ -1725,7 +1389,6 @@ function OmniApp() {
       </div>
 
 
-      {/* MANUAL TRADING TERMINAL */}
       <div className="card trading-manual-card" style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
         <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <span>🎯</span> Terminale Azionario Manuale
@@ -1773,7 +1436,6 @@ function OmniApp() {
         )}
       </div>
 
-      {/* AI INVESTMENT HUB */}
       <div className="card trading-ai-card" style={{ marginTop: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
         <div className="trading-ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
           <div>
@@ -1885,28 +1547,6 @@ function OmniApp() {
           <div className="card-title">Liquidità Libera</div>
           <div className="portfolio-value" style={{ color: '#10b981' }}>${Number(status.cash || 0).toFixed(2)}</div>
         </div>
-        <div className="card col-span-4">
-          <div className="card-title">P/L Tempo Reale</div>
-          <div className="portfolio-value" style={{ color: Number(status.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
-            {Number(status.profit || 0) >= 0 ? '+' : ''}{Number(status.profit || 0).toFixed(2)}
-          </div>
-        </div>
-        <div className="card col-span-4">
-          <div className="card-title">Win Rate</div>
-          <div className="portfolio-value" style={{ color: '#f59e0b' }}>{Number(status.win_rate || 0).toFixed(1)}%</div>
-        </div>
-        <div className="card col-span-4">
-          <div className="card-title">Profit Factor</div>
-          <div className="portfolio-value" style={{ color: '#8b5cf6' }}>{Number(status.profit_factor || 0).toFixed(2)}</div>
-        </div>
-        <div className="card col-span-4">
-          <div className="card-title">Sharpe Ratio</div>
-          <div className="portfolio-value" style={{ color: '#00d4aa' }}>{Number(status.sharpe_ratio || 0).toFixed(2)}</div>
-        </div>
-        <div className="card col-span-4">
-          <div className="card-title">Max Drawdown</div>
-          <div className="portfolio-value" style={{ color: '#ef4444' }}>-{Number(status.max_drawdown || 0).toFixed(2)}%</div>
-        </div>
       </div>
 
 
@@ -1964,105 +1604,9 @@ function OmniApp() {
                     </span>
                   )}
                 </div>
-                {/* AI Sentiment Integration */}
-                {status.table_data && status.table_data.find(r => r.symbol === sym) && (
-                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
-                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
-                      <span style={{ color: '#64748b' }}>📊 Indicatori:</span>
-                      <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
-                        {status.table_data.find(r => r.symbol === sym).prediction}
-                      </span>
-                    </div>
-                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
-                      <span style={{ color: '#64748b' }}>🧠 AI Sentiment:</span>
-                      <span>
-                        {status.table_data.find(r => r.symbol === sym).sentiment === 'BULLISH' && <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 BULLISH (+15% Boost)</span>}
-                        {status.table_data.find(r => r.symbol === sym).sentiment === 'BEARISH' && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 BEARISH (VETO Attivo)</span>}
-                        {status.table_data.find(r => r.symbol === sym).sentiment === 'NEUTRAL' && <span style={{ color: 'var(--text-secondary)' }}>⚪ NEUTRAL</span>}
-                      </span>
-                    </div>
-                  </div>
-                )}
               </div>
             ))
           )}
-          <h3 style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Impostazioni IA</h3>
-          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
-            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
-              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Soglia Aggressività IA</label>
-              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>{status.aggressiveness || 55}%</span>
-            </div>
-            <input 
-              type="range" min="10" max="90" step="1"
-              value={status.aggressiveness || 55}
-              disabled={isDemoMode}
-              onChange={async (e) => {
-                const val = e.target.value;
-                setStatus(prev => ({ ...prev, aggressiveness: val }));
-                await authFetch('/api/config', {
-                  method: 'POST', headers: { 'Content-Type': 'application/json' },
-                  body: JSON.stringify({ aggressiveness: val })
-                });
-              }}
-              style={{ width: '100%', accentColor: '#06b6d4', ...demoActionStyle }}
-            />
-          </div>
-          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
-            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
-              <div>
-                <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 'bold' }}>Selezione dinamica titoli</div>
-                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
-                  Ranking su momentum, liquidità e volatilità
-                </div>
-              </div>
-              <button
-                className="btn"
-                onClick={async () => {
-                  const res = await authFetch('/api/config', {
-                    method: 'POST',
-                    headers: { 'Content-Type': 'application/json' },
-                    body: JSON.stringify({ refresh_symbols: true, symbol_count: 7 })
-                  });
-                  const data = await res.json();
-                  if (res.ok) {
-                    setStatus(prev => ({ ...prev, symbols: data.symbols, symbol_selection: data.symbol_selection }));
-                  }
-                }}
-                {...demoActionButtonProps()}
-                style={demoActionStyle}
-              >
-                AGGIORNA WATCHLIST
-              </button>
-            </div>
-            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
-              {status.symbols?.join(' • ') || 'Nessun simbolo disponibile'}
-            </div>
-            {status.symbol_selection?.ranked?.length > 0 && (
-              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
-                {status.symbol_selection.ranked.map((row) => (
-                  <div
-                    key={row.symbol}
-                    style={{
-                      padding: '0.65rem 0.75rem',
-                      borderRadius: '8px',
-                      background: 'rgba(255,255,255,0.04)',
-                      border: '1px solid rgba(255,255,255,0.05)'
-                    }}
-                  >
-                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
-                      <div style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{row.symbol}</div>
-                      <div style={{ color: '#06b6d4', fontFamily: 'monospace', fontSize: '0.8rem' }}>
-                        score {Number(row.score || 0).toFixed(3)}
-                      </div>
-                    </div>
-                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
-                      {row.selection_reason || 'Selezione dinamica attiva'}
-                    </div>
-                  </div>
-                ))}
-              </div>
-            )}
-          </div>
         </div>
 
         <div className="card col-span-6">
@@ -2080,429 +1624,6 @@ function OmniApp() {
     </div>
   );
 
-  
-  const renderArbitrageView = () => {
-    const highRiskTokens = ["DOGE", "SHIB", "PEPE", "WIF", "LINK"];
-    return (
-      <div className="module-content module-content--defi">
-        <div className="header module-page-header defi-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
-          <div>
-            <h2>DeFi Arbitrage <span className="badge badge-gold" style={{ marginLeft: '1rem', verticalAlign: 'middle' }}>MODALITÀ SIMULAZIONE ATTIVA</span></h2>
-            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Esecuzione automatica live (Paper Trading)</div>
-            <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '6px', display: 'inline-block' }}>
-              <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Portafoglio Virtuale:</span>
-              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>${Number(status.portfolio_value || 0).toFixed(2)}</span>
-            </div>
-          </div>
-          <button 
-            className={`btn ${status.modules?.crypto_arb ? 'btn-stop' : 'btn-start'}`}
-            onClick={() => toggleModule('crypto_arb', status.modules?.crypto_arb)}
-            {...demoActionButtonProps()}
-            style={demoActionStyle}
-          >
-            {status.modules?.crypto_arb ? 'FERMA ARBITRAGGIO' : 'ATTIVA MOTORE ARBITRAGGIO'}
-          </button>
-        </div>
-
-        <div className="dashboard-grid">
-          <div className="card col-span-4" style={{ textAlign: "center" }}>
-            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png" alt="Binance" style={{ width: '40px', height: '40px', objectFit: 'cover', marginBottom: '1rem', borderRadius: '50%' }} />
-            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Binance (Ask)</h3>
-            <div className="crypto-price" style={{ color: '#06b6d4', marginTop: '1rem' }}>
-              ${Number(status.arb_prices?.binance || 0).toFixed(2)}
-            </div>
-          </div>
-
-          <div className="card col-span-4" style={{ textAlign: "center" }}>
-            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/24.png" alt="Kraken" style={{ width: '40px', height: '40px', objectFit: 'cover', marginBottom: '1rem', borderRadius: '50%' }} />
-            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Kraken (Ask)</h3>
-            <div className="crypto-price" style={{ color: '#3b82f6', marginTop: '1rem' }}>
-              ${Number(status.arb_prices?.kraken || 0).toFixed(2)}
-            </div>
-          </div>
-          
-          <div className="card col-span-4" style={{ textAlign: "center", borderColor: "rgba(16,185,129,0.3)" }}>
-            <h3 style={{ color: '#10b981', margin: 0, fontSize: '1rem' }}>Spread Attuale</h3>
-            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.5rem' }}>
-              {Math.abs(Number(status.arb_prices?.binance || 0) - Number(status.arb_prices?.kraken || 0)).toFixed(2)}$
-            </div>
-            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Soglia profitto netto: ~120$ (0.2%)</div>
-          </div>
-        </div>
-
-        <h3 style={{ color: '#e2e8f0', marginTop: '2rem', marginBottom: '1rem' }}>Radar Inefficienze BTC</h3>
-        <div style={{ background: '#000', padding: '1.5rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
-          {status.arb_logs?.map((l, i) => (
-            <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("TROVATO") ? '#f59e0b' : '#10b981' }}>{l}</div>
-          ))}
-          {(!status.arb_logs || status.arb_logs.length === 0) && (
-            <div style={{ color: '#64748b' }}>Radar inattivo. Clicca su Attiva Motore Arbitraggio per iniziare la scansione dei due Exchange...</div>
-          )}
-        </div>
-
-        <hr style={{ margin: '4rem 0 3rem 0', borderColor: 'rgba(255,255,255,0.1)' }} />
-
-        {/* --- HIGH RISK ARBITRAGE SECTION --- */}
-        <div className="header defi-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
-          <div>
-            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
-              <span>⚠️</span> DeFi Arbitrage - HIGH RISK (Altcoins & Meme)
-            </h2>
-            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Scansione e hedging automatico su asset ad alta volatilità (DOGE, SHIB, PEPE, WIF, LINK)</div>
-          </div>
-          <div className="defi-highrisk-actions" style={{ display: 'flex', gap: '1rem' }}>
-            <button 
-              className={`btn ${status.auto_bet_enabled ? 'btn-stop' : 'btn-start'}`}
-              style={{ background: status.auto_bet_enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.8)', border: '1px solid #10b981', color: '#fff' }}
-              onClick={() => {
-                authFetch('/api/auto-bet-settings', {
-                  method: 'POST',
-                  headers: { 'Content-Type': 'application/json' },
-                  body: JSON.stringify({ enabled: !status.auto_bet_enabled })
-                }).then(() => {
-                  setStatus(prev => ({...prev, auto_bet_enabled: !prev.auto_bet_enabled}));
-                });
-              }}
-              {...demoActionButtonProps()}
-            >
-              {status.auto_bet_enabled ? '⚡ DISATTIVA AUTO-SCALPING AI (ORA ACCESO)' : '⚡ ATTIVA AUTO-SCALPING AI (ORA SPENTO)'}
-            </button>
-            <button 
-              className={`btn ${status.modules?.high_risk_crypto_arb ? 'btn-stop' : 'btn-start'}`}
-              style={{ background: status.modules?.high_risk_crypto_arb ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.6)', border: '1px solid #ef4444', color: '#fff' }}
-              onClick={() => toggleModule('high_risk_crypto_arb', status.modules?.high_risk_crypto_arb)}
-              {...demoActionButtonProps()}
-            >
-              {status.modules?.high_risk_crypto_arb ? 'FERMA ALTO RISCHIO' : 'ATTIVA MOTORE ALTO RISCHIO'}
-            </button>
-          </div>
-        </div>
-
-        {/* Real-time prices grid for Altcoins */}
-        <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', marginBottom: '2rem' }}>
-          <table className="data-table">
-            <thead>
-              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
-                <th style={{ padding: '0.8rem 1rem' }}>Asset</th>
-                <th style={{ padding: '0.8rem 1rem' }}>Binance Ask</th>
-                <th style={{ padding: '0.8rem 1rem' }}>Kraken Ask</th>
-                <th style={{ padding: '0.8rem 1rem' }}>Spread Attuale</th>
-                <th style={{ padding: '0.8rem 1rem' }}>Stato</th>
-              </tr>
-            </thead>
-            <tbody>
-              {highRiskTokens.map(token => {
-                const bPrice = status.high_risk_arb_prices?.[token]?.binance || 0;
-                const kPrice = status.high_risk_arb_prices?.[token]?.kraken || 0;
-                const spread = Math.abs(bPrice - kPrice);
-                const spreadPerc = bPrice > 0 ? (spread / bPrice) * 100 : 0;
-                
-                return (
-                  <tr key={token} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
-                    <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{token}/USD</td>
-                    <td style={{ padding: '1rem', color: '#06b6d4' }}>${bPrice > 0 ? bPrice.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4) : 'N/A'}</td>
-                    <td style={{ padding: '1rem', color: '#3b82f6' }}>${kPrice > 0 ? kPrice.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4) : 'N/A'}</td>
-                    <td style={{ padding: '1rem', color: spreadPerc > 0.1 ? '#10b981' : 'var(--text-secondary)' }}>
-                      ${spread.toFixed(token === "PEPE" || token === "SHIB" ? 6 : 4)} ({spreadPerc.toFixed(3)}%)
-                    </td>
-                    <td style={{ padding: '1rem' }}>
-                      <span className={`badge ${spreadPerc > 0.2 ? 'badge-active' : 'badge-idle'}`} style={{ fontSize: '0.8rem' }}>
-                        {spreadPerc > 0.2 ? 'SPREAD RILEVATO' : 'MONITORANDO'}
-                      </span>
-                    </td>
-                  </tr>
-                );
-              })}
-            </tbody>
-          </table>
-        </div>
-
-        <h3 style={{ color: '#ef4444', marginTop: '2rem', marginBottom: '1rem' }}>Radar Inefficienze HIGH RISK</h3>
-        <div className="terminal-window" style={{ height: "250px" }}>
-          {status.high_risk_arb_logs?.map((l, i) => (
-            <div key={i} style={{ marginBottom: '0.5rem', color: l.includes("HEDGE") || l.includes("SCALP") ? '#f59e0b' : '#f87171' }}>{l}</div>
-          ))}
-          {(!status.high_risk_arb_logs || status.high_risk_arb_logs.length === 0) && (
-            <div style={{ color: '#78716c' }}>Radar ad alto rischio inattivo. Clicca su Attiva Motore Alto Rischio per avviare il monitoraggio dei book...</div>
-          )}
-        </div>
-
-        <hr style={{ margin: '3rem 0 2rem 0', borderColor: 'rgba(239, 68, 68, 0.15)' }} />
-
-        {/* --- VOLATILITY RADAR + QUICK SCALPING --- */}
-        <div className="defi-volatility-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
-          <div style={{ fontSize: '1.5rem' }}>🌡️</div>
-          <div>
-            <h2 style={{ margin: 0, color: '#f59e0b' }}>Volatility Radar & Quick Scalping</h2>
-            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
-              Top 5 crypto più volatili nelle ultime 24h — buy/sell rapido con 1 click
-            </div>
-          </div>
-        </div>
-
-        {/* Size selector */}
-        <div className="defi-size-selector" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
-          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Size trade:</span>
-          {[50, 100, 250, 500].map(s => (
-            <button
-              key={s}
-              onClick={() => setTradeSize(s)}
-              style={{
-                padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold',
-                background: tradeSize === s ? '#f59e0b' : 'rgba(255,255,255,0.05)',
-                color: tradeSize === s ? '#000' : 'var(--text-primary)',
-                border: tradeSize === s ? 'none' : '1px solid rgba(255,255,255,0.1)'
-              }}
-            >${s}</button>
-          ))}
-          <span className="defi-balance-label" style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 'bold' }}>
-            💰 Saldo Virtuale: ${Number(status.cash || 0).toFixed(2)}
-          </span>
-        </div>
-
-        {/* Volatile assets table with BUY/SELL buttons */}
-        {(!status.high_risk_volatile_assets || status.high_risk_volatile_assets.length === 0) ? (
-          <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: '#78716c' }}>
-            🌡️ Radar inattivo — Attiva il motore HIGH RISK per scoprire le top crypto più volatili del momento
-          </div>
-        ) : (
-          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.15)', overflow: 'hidden' }}>
-            <table className="data-table">
-              <thead>
-                <tr style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
-                  <th style={{ padding: '0.9rem 1rem' }}>Rank</th>
-                  <th style={{ padding: '0.9rem 1rem' }}>Token</th>
-                  <th style={{ padding: '0.9rem 1rem' }}>Prezzo</th>
-                  <th style={{ padding: '0.9rem 1rem' }}>Volatilità 24h</th>
-                  <th style={{ padding: '0.9rem 1rem' }}>Variazione %</th>
-                  <th style={{ padding: '0.9rem 1rem' }}>Quick Trade</th>
-                </tr>
-              </thead>
-              <tbody>
-                {status.high_risk_volatile_assets.map((asset, i) => {
-                  const isPositive = asset.change_24h >= 0;
-                  const isVeryVolatile = asset.volatility > 10;
-                  const decimals = asset.price < 0.01 ? 8 : asset.price < 1 ? 6 : 4;
-                  return (
-                    <tr key={asset.symbol} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
-                      <td style={{ padding: '0.9rem 1rem', color: '#f59e0b', fontWeight: 'bold' }}>#{i + 1}</td>
-                      <td style={{ padding: '0.9rem 1rem' }}>
-                        <div
-                          onClick={isDemoMode ? undefined : () => openAiSignal(asset)}
-                          style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '1rem', cursor: isDemoMode ? 'not-allowed' : 'pointer', textDecoration: 'underline dotted', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: isDemoMode ? 0.5 : 1 }}
-                          title="Clicca per analisi AI"
-                        >
-                          🤖 {asset.symbol}
-                        </div>
-                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{asset.pair}</div>
-                      </td>
-                      <td style={{ padding: '0.9rem 1rem', color: '#e2e8f0' }}>${asset.price.toFixed(decimals)}</td>
-                      <td style={{ padding: '0.9rem 1rem' }}>
-                        <span style={{
-                          background: isVeryVolatile ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.1)',
-                          color: isVeryVolatile ? '#ef4444' : '#f59e0b',
-                          padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold'
-                        }}>
-                          {asset.volatility.toFixed(1)}%
-                        </span>
-                      </td>
-                      <td style={{ padding: '0.9rem 1rem', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
-                        {isPositive ? '+' : ''}{asset.change_24h.toFixed(2)}%
-                      </td>
-                      <td style={{ padding: '0.9rem 1rem' }}>
-                        <div style={{ display: 'flex', gap: '0.5rem' }}>
-                          <button
-                            id={`buy-${asset.symbol}`}
-                            onClick={() => quickTrade(asset.symbol, 'buy', tradeSize)}
-                            disabled={isDemoMode}
-                            style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isDemoMode ? 0.5 : 1 }}
-                          >⬆ BUY</button>
-                          <button
-                            id={`sell-${asset.symbol}`}
-                            onClick={() => quickTrade(asset.symbol, 'sell', tradeSize)}
-                            disabled={isDemoMode}
-                            style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isDemoMode ? 0.5 : 1 }}
-                          >⬇ SELL</button>
-                        </div>
-                      </td>
-                    </tr>
-                  );
-                })}
-              </tbody>
-            </table>
-          </div>
-        )}
-
-        {tradeResult && (
-          <div style={{
-            marginTop: '1rem', padding: '0.8rem 1.2rem', borderRadius: '8px',
-            background: tradeResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
-            border: `1px solid ${tradeResult.error ? '#ef4444' : '#10b981'}`,
-            color: tradeResult.error ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontSize: '0.9rem'
-          }}>
-            {tradeResult.error
-              ? `❌ ${tradeResult.error}`
-              : `✅ ${tradeResult.side?.toUpperCase()} ${tradeResult.qty} ${tradeResult.symbol} @ $${tradeResult.price?.toFixed ? tradeResult.price.toFixed(6) : tradeResult.price} — Saldo: $${tradeResult.virtual_cash}${tradeResult.monitored ? ' — 👁️ IN SORVEGLIANZA' : ''}`
-            }
-          </div>
-        )}
-
-        {/* ===== POSIZIONI SORVEGLIATE ===== */}
-        <div style={{ marginTop: '2rem' }}>
-          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
-            <span style={{ fontSize: '1.3rem' }}>👁️</span>
-            <h3 style={{ margin: 0, color: '#a78bfa' }}>Posizioni in Sorveglianza Auto-Exit</h3>
-            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
-              {(status.monitored_positions || []).length} APERTE
-            </span>
-          </div>
-          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
-            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
-              <thead>
-                <tr style={{ background: 'rgba(167,139,250,0.08)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Token</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Buy Price</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Target / Picco</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>📊 P&L</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Trend</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Qty</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Investito</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Ore</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Azione</th>
-                </tr>
-              </thead>
-              <tbody>
-                {(!status.monitored_positions || status.monitored_positions.length === 0) ? (
-                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nessuna posizione in sorveglianza. Acquista un token per iniziare.</td></tr>
-                ) : status.monitored_positions.map((pos, i) => {
-                    const dec = pos.buy_price < 0.01 ? 8 : pos.buy_price < 1 ? 6 : 4;
-                    const currentPrice = status.high_risk_arb_prices?.[pos.symbol]?.binance || pos.buy_price;
-                    const pnlPct = ((currentPrice - pos.buy_price) / pos.buy_price) * 100;
-                    const pnlColor = pnlPct >= 0 ? '#10b981' : '#ef4444';
-                    
-                    const sparklineData = pos.price_history ? pos.price_history.map(ph => ({ pnl: ((ph.price - pos.buy_price) / pos.buy_price) * 100 })) : [];
-
-                    return (
-                      <tr key={`${pos.symbol}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
-                        <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', color: '#a78bfa' }}>
-                          <span 
-                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: isDemoMode ? 'not-allowed' : 'pointer', opacity: isDemoMode ? 0.5 : 1 }}
-                            onClick={isDemoMode ? undefined : () => openAiSignal({ symbol: pos.symbol, price: currentPrice, volatility: 0, change_24h: 0 })}
-                            title="Chiedi all'IA"
-                          >
-                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
-                            <span style={{ borderBottom: '1px dashed #a78bfa' }}>{pos.symbol}</span>
-                          </span>
-                        </td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#e2e8f0' }}>${Number(pos.buy_price).toFixed(dec)}</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#f59e0b' }}>
-                          {pos.target_price && <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>🎯 ${Number(pos.target_price).toFixed(dec)}</div>}
-                          <div>${Number(pos.peak_price || pos.buy_price).toFixed(dec)}</div>
-                        </td>
-                        <td style={{ padding: '0.8rem 1rem', color: pnlColor, fontWeight: 'bold' }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</td>
-                        <td style={{ padding: '0.8rem 1rem' }}>
-                           <HighRiskPnLSparkline history={sparklineData} />
-                        </td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>{Number(pos.qty).toFixed(4)}</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>${Number(pos.amount).toFixed(2)}</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>{pos.timestamp}</td>
-                        <td style={{ padding: '0.8rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
-                          <button
-                            onClick={() => {
-                              const t = prompt(`Inserisci Target Price per ${pos.symbol}:`, pos.target_price || '');
-                              if (t !== null) {
-                                authFetch('/api/high-risk/set-target', {
-                                  method: 'POST',
-                                  headers: { 'Content-Type': 'application/json' },
-                                  body: JSON.stringify({ symbol: pos.symbol, target_price: t ? parseFloat(t) : null })
-                                });
-                              }
-                            }}
-                            disabled={isDemoMode}
-                            style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', cursor: 'pointer', fontSize: '0.8rem' }}
-                            title="Set Target Price"
-                          >🎯</button>
-                          <button
-                            onClick={() => quickTrade(pos.symbol, 'sell', pos.amount)}
-                            disabled={isDemoMode}
-                            style={{ padding: '0.35rem 0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
-                          >✕ Chiudi</button>
-                        </td>
-                      </tr>
-                    );
-                  })}
-                </tbody>
-              </table>
-              <div style={{ padding: '0.6rem 1rem', background: 'rgba(167,139,250,0.05)', color: '#64748b', fontSize: '0.78rem', borderTop: '1px solid rgba(167,139,250,0.1)' }}>
-                🔔 Trailing stop: -1.5% dal picco | 🛡️ Stop loss: -5% dal buy price | Controllo ogni 30 sec
-              </div>
-            </div>
-          </div>
-        <div style={{ marginTop: '2rem' }}>
-          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
-            <span style={{ fontSize: '1.3rem' }}>🔄</span>
-            <h3 style={{ margin: 0, color: '#fcd34d' }}>Re-Entry Watchlist</h3>
-            <span style={{ background: 'rgba(252,211,77,0.15)', color: '#fcd34d', border: '1px solid #fcd34d', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
-              {(status.reentry_watchlist || []).length} IN ATTESA
-            </span>
-          </div>
-          <div className="data-table-wrapper defi-table-wrapper" style={{ background: 'rgba(252,211,77,0.04)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
-            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
-              <thead>
-                <tr style={{ background: 'rgba(252,211,77,0.08)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Token</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Exit Price (Prev)</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Re-entry Trigger (Drop)</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Qty Base</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Tentativo</th>
-                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>Azione</th>
-                </tr>
-              </thead>
-              <tbody>
-                {(!status.reentry_watchlist || status.reentry_watchlist.length === 0) ? (
-                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nessun token in attesa di rientro automatico.</td></tr>
-                ) : status.reentry_watchlist.map((pos, i) => {
-                    const dec = pos.exit_price < 0.01 ? 8 : pos.exit_price < 1 ? 6 : 4;
-                    const trigger = pos.exit_price * (1 - pos.drop_target);
-                    return (
-                      <tr key={`${pos.symbol}-reentry-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
-                        <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', color: '#fcd34d' }}>
-                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
-                            {pos.symbol}
-                          </span>
-                        </td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#e2e8f0' }}>${Number(pos.exit_price).toFixed(dec)}</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#ef4444' }}>${Number(trigger).toFixed(dec)} ({(pos.drop_target * 100).toFixed(1)}%)</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#94a3b8' }}>{Number(pos.qty).toFixed(4)}</td>
-                        <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{pos.attempts} / 3</td>
-                        <td style={{ padding: '0.8rem 1rem' }}>
-                          <button
-                            onClick={() => {
-                              authFetch('/api/high-risk/cancel-reentry', {
-                                method: 'POST',
-                                headers: { 'Content-Type': 'application/json' },
-                                body: JSON.stringify({ symbol: pos.symbol })
-                              });
-                            }}
-                            disabled={isDemoMode}
-                            style={{ padding: '0.35rem 0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
-                          >✕ Annulla</button>
-                        </td>
-                      </tr>
-                    );
-                  })}
-                </tbody>
-              </table>
-              <div style={{ padding: '0.6rem 1rem', background: 'rgba(252,211,77,0.05)', color: '#64748b', fontSize: '0.78rem', borderTop: '1px solid rgba(252,211,77,0.1)' }}>
-                🔄 Ricompra automatica quando il prezzo cala e c'è segnale BUY. Massimo 3 tentativi.
-              </div>
-            </div>
-          </div>
-      </div>
-    );
-  };
-
-  
   const SPORT_LABELS = {
     soccer_italy_serie_a:        '⚽ Serie A',
     soccer_epl:                  '⚽ Premier League',
@@ -2545,7 +1666,6 @@ function OmniApp() {
         </button>
       </div>
 
-      {/* --- Pannello Auto-Bet --- */}
       <div className="sports-auto-bet-panel" style={{
         background: status.auto_bet_enabled
           ? 'rgba(212,175,55,0.08)'
@@ -2562,7 +1682,6 @@ function OmniApp() {
         flexWrap: 'wrap',
         transition: 'all 0.3s'
       }}>
-        {/* Toggle on/off */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
           <span style={{ fontWeight: 'bold', color: '#e2e8f0', fontSize: '0.95rem' }}>🤖 Auto-Bet</span>
           <div
@@ -2608,7 +1727,6 @@ function OmniApp() {
           </span>
         </div>
 
-        {/* Slider soglia */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: '220px' }}>
           <span style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Soglia minima:</span>
           <input
@@ -2628,14 +1746,6 @@ function OmniApp() {
                 body: JSON.stringify({ threshold: val })
               });
             }}
-            onTouchEnd={async (e) => {
-              const val = parseFloat(e.target.value);
-              await authFetch('/api/auto-bet-settings', {
-                method: 'POST',
-                headers: { 'Content-Type': 'application/json' },
-                body: JSON.stringify({ threshold: val })
-              });
-            }}
             style={{ flex: 1, accentColor: '#d4af37', cursor: isDemoMode ? 'not-allowed' : 'pointer', opacity: isDemoMode ? 0.5 : 1 }}
           />
           <span style={{
@@ -2645,16 +1755,9 @@ function OmniApp() {
             fontSize: '1rem'
           }}>{Number(status.auto_bet_threshold ?? 10).toFixed(1)}%</span>
         </div>
-
-        {status.auto_bet_enabled && (
-          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
-            Il sistema punta automaticamente €100 su ogni surebet ≥ {Number(status.auto_bet_threshold ?? 10).toFixed(1)}%
-          </div>
-        )}
       </div>
 
       <div className="dashboard-grid">
-        {/* Radar Logs */}
         <div className="card col-span-6">
           <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Radar Bookmakers Live</h3>
           <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', height: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
@@ -2667,7 +1770,6 @@ function OmniApp() {
           </div>
         </div>
 
-        {/* SureBets Found */}
         <div className="card col-span-6">
           <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>SureBets — ordinate per profitto 📊</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
@@ -2680,7 +1782,6 @@ function OmniApp() {
                   : idx === 0 ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(16, 185, 129, 0.3)',
                 boxShadow: Number(sb.profit_margin) >= 10 ? '0 0 12px rgba(212,175,55,0.25)' : 'none'
               }}>
-                {/* Header card con sport, rank e profitto */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                     {idx === 0 && <span style={{ fontSize: '1.1rem' }}>🥇</span>}
@@ -2730,7 +1831,6 @@ function OmniApp() {
                   Investimento Totale: <strong>€100.00</strong> ➔ Ritorno Garantito: <strong style={{ color: '#10b981' }}>€{Number(sb.guaranteed_return || 0).toFixed(2)}</strong>
                 </div>
 
-                {/* Bottone piazza scommessa */}
                 {(() => {
                   const betState = placedBets[sb.id];
                   if (betState === 'placed') return (
@@ -2873,7 +1973,6 @@ function OmniApp() {
                 </div>
               </div>
 
-              {/* Progress bar sentiment */}
               <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ 
                   width: `${vb.confidence}%`, 
@@ -3002,7 +2101,6 @@ function OmniApp() {
       navigator.clipboard.writeText(aiIdea.prompt);
       alert("Prompt copiato!");
     } else {
-      // Fallback per HTTP non sicuro
       const textArea = document.createElement("textarea");
       textArea.value = aiIdea.prompt;
       textArea.style.position = "fixed";
@@ -3066,18 +2164,11 @@ function OmniApp() {
               </div>
             )}
           </div>
-          
-          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
-            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>2. Integrazione API Social (Opzionale)</h3>
-            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Collega gli account per la pubblicazione automatica dei video generati.</p>
-            <input type="text" placeholder="YouTube Data API Key" value={apiKeys.youtube_key || ''} onChange={e => setApiKeys({...apiKeys, youtube_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '0.5rem' }} />
-            <input type="text" placeholder="TikTok Access Token" value={apiKeys.tiktok_key || ''} onChange={e => setApiKeys({...apiKeys, tiktok_key: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
-          </div>
         </div>
 
         <div className="card col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', opacity: aiIdea ? 1 : 0.5, pointerEvents: aiIdea ? 'auto' : 'none' }}>
-            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>3. Carica Video Generato</h3>
+            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>2. Carica Video Generato</h3>
             <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Genera il video gratuitamente su Veo incollando il prompt, scarica l'MP4 e caricalo qui.</p>
             <input type="file" id="video-upload" accept="video/mp4" style={{ display: 'none' }} onChange={handleVideoUpload} />
             <button 
@@ -3098,71 +2189,15 @@ function OmniApp() {
               <div style={{ color: '#64748b' }}>In attesa di video in coda...</div>
             )}
           </div>
-          <div className="card col-span-6">
-            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
-              <h3 style={{ color: '#e2e8f0', margin: 0 }}>Coda e Pubblicazioni</h3>
-              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
-                Totale Generato (Oggi): +${Number(status.ai_videos?.reduce((acc, v) => acc + (v.earnings || 0), 0) || 0).toFixed(2)}
-              </div>
-            </div>
-            
-            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
-              {status.ai_videos?.map(video => (
-                <div key={video.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
-                  <div style={{ display: 'flex', padding: '1rem', gap: '1rem' }}>
-                    <img src={video.thumbnail} alt="thumb" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '6px' }} />
-                    <div className="card col-span-6">
-                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>{video.title}</div>
-                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>👀 {video.views?.toLocaleString()} views</div>
-                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>+${video.earnings?.toFixed(2)}</div>
-                    </div>
-                  </div>
-                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
-                    <span>Pubblicato {video.timestamp}</span>
-                    <span style={{ color: '#a855f7' }}>TikTok / Shorts</span>
-                  </div>
-                </div>
-              ))}
-            </div>
-            {(!status.ai_videos || status.ai_videos.length === 0) && (
-              <div style={{ gridColumn: '1 / -1', padding: '3rem', margin: '1rem 0', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
-                Nessun video generato.
-              </div>
-            )}
-          </div>
         </div>
       </div>
     </div>
   );
 
-  const renderComingSoon = (title, mod_id, description) => (
-    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
-      <h2>{title}</h2>
-      <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>{description}</p>
-      
-      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
-        <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Stato Modulo</h3>
-        <button 
-          className={`btn ${status.modules?.[mod_id] ? 'btn-stop' : 'btn-start'}`}
-          onClick={() => toggleModule(mod_id, status.modules?.[mod_id])}
-          {...demoActionButtonProps()}
-          style={{ fontSize: '1.2rem', padding: '1rem 3rem', ...demoActionStyle }}
-        >
-          {status.modules?.[mod_id] ? 'DISATTIVA MOTORE' : 'ATTIVA MOTORE'}
-        </button>
-        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
-          {status.modules?.[mod_id] ? 'Il motore è attivo e gira in background.' : 'Attualmente in pausa.'}
-        </p>
-      </div>
-    </div>
-  );
-
   const renderSaaSView = () => {
     const overview = billingOverview || DEMO_BILLING_OVERVIEW;
     const metrics = overview.metrics || {};
-    const plans = overview.plans || [];
     const customers = overview.customers || [];
-    const leads = overview.leads || [];
     const activity = overview.recent_activity || [];
 
     return (
@@ -3431,601 +2466,76 @@ function OmniApp() {
       </div>
     );
   };
-
   
   if (!isAuthenticated) {
-
     const landingPlans = DEMO_BILLING_OVERVIEW.plans || [];
     const selectedPlan = landingPlans.find((plan) => plan.id === selectedPlanId);
-    const landingTicker = [
-      { market: 'BTC/USD', price: '$118,420', change: '+2.6%', direction: 'up' },
-      { market: 'ETH/USD', price: '$6,180', change: '+1.9%', direction: 'up' },
-      { market: 'SOL/USD', price: '$242', change: '+4.2%', direction: 'up' },
-      { market: 'GOLD', price: '$2,612', change: '-0.4%', direction: 'down' },
-      { market: 'NASDAQ', price: '21,440', change: '+0.8%', direction: 'up' },
-      { market: 'EUR/USD', price: '1.11', change: '+0.2%', direction: 'up' },
-    ];
-    const landingStats = [
-      { value: '24/7', label: 'visibilità costante su capitale, segnali e rischio' },
-      { value: 'Multi-device', label: 'esperienza fluida su iPhone, Android, tablet e desktop' },
-      { value: '3 step', label: 'accessi pensati per livelli operativi diversi' },
-    ];
-    const landingFeatures = [
-      {
-        icon: '🧠',
-        title: 'AI Avanzata',
-        text: 'Algoritmi e letture assistite aiutano a interpretare contesto, opportunità e segnali in tempo reale con più lucidità.',
-      },
-      {
-        icon: '⚡',
-        title: 'Esecuzione più rapida',
-        text: 'Interfaccia, dati e moduli sono organizzati per ridurre attrito e trasformare più in fretta l’analisi in azione.',
-      },
-      {
-        icon: '🛡️',
-        title: 'Sicurezza premium',
-        text: 'Accesso biometrico, gestione chiavi e percorsi protetti rafforzano la percezione di solidità fin dal primo ingresso.',
-      },
-      {
-        icon: '📊',
-        title: 'Control room evoluta',
-        text: 'Dashboard, trading, DeFi e lettura di segnali convivono in un unico ambiente credibile e leggibile.',
-      },
-      {
-        icon: '📱',
-        title: 'Multi-device reale',
-        text: 'L’esperienza resta forte e pulita su iPhone, Android, tablet e desktop, senza perdere presenza visiva.',
-      },
-      {
-        icon: '🎧',
-        title: 'Percorso guidato',
-        text: 'Dalla prima impressione fino all’accesso, ogni passaggio accompagna l’utente senza spezzare fiducia e attenzione.',
-      },
-    ];
-    const landingFlow = [
-      {
-        number: '1',
-        title: 'Scopri il sistema',
-        text: 'La pagina iniziale mostra subito posizionamento, forza visiva e valore percepito del prodotto.',
-      },
-      {
-        number: '2',
-        title: 'Scegli lo step',
-        text: 'L’utente capisce con chiarezza quale accesso è più adatto al suo profilo, senza confusione.',
-      },
-      {
-        number: '3',
-        title: 'Entra senza attrito',
-        text: 'Registrazione o accesso avvengono nella stessa esperienza, mantenendo continuità e qualità percepita.',
-      },
-    ];
-    const landingTestimonials = [
-      {
-        initials: 'MQ',
-        name: 'Marco',
-        role: 'Private investor',
-        quote: 'La prima impressione è forte: sembra un ambiente serio, ordinato e costruito per chi vuole controllo vero.',
-      },
-      {
-        initials: 'GV',
-        name: 'Giulia',
-        role: 'Consulente indipendente',
-        quote: 'Non comunica solo funzionalità, comunica posizionamento. Questo cambia molto la percezione del prodotto.',
-      },
-      {
-        initials: 'LD',
-        name: 'Luca',
-        role: 'Trader attivo',
-        quote: 'Finalmente una presentazione che accompagna bene alla scelta, senza buttarti subito dentro un login freddo.',
-      },
-    ];
-    const landingTrustPillars = [
-      'Presenza visiva premium',
-      'Percorso lineare verso l’accesso',
-      'Coerenza piena tra presentazione e utilizzo',
-    ];
     if (showLanding) {
       return (
         <div className="sales-landing">
-          <div className="sales-bg-animation" />
-          <div className="sales-bg-animation sales-bg-animation--second" />
-
-          <nav className="sales-nav">
-            <a href="#landing-top" className="sales-logo">
-              <img src="/aureo-icon.png" alt="Aureo" />
-              <span>AUREO OS</span>
-            </a>
-            <div className="sales-nav-links">
-              <a href="#landing-features">Funzionalità</a>
-              <a href="#landing-flow">Percorso</a>
-              <a href="#landing-pricing">Step</a>
-              <a href="#landing-proof">Impatto</a>
-            </div>
-            <div className="sales-nav-actions">
-              <button className="btn btn-outline" onClick={() => setShowLanding(false)}>Accedi</button>
-              <button className="btn btn-start" onClick={openPricingSection}>Scopri Aureo</button>
-            </div>
-          </nav>
-
-          <div className="sales-ticker">
-            <div className="sales-ticker-track">
-              {[...landingTicker, ...landingTicker].map((item, index) => (
-                <div key={`${item.market}-${index}`} className="sales-ticker-item">
-                  <span className="sales-ticker-market">{item.market}</span>
-                  <span className="sales-ticker-price">{item.price}</span>
-                  <span className={`sales-ticker-change sales-ticker-change--${item.direction}`}>{item.change}</span>
-                </div>
-              ))}
-            </div>
-          </div>
-
-          <div className="sales-page" id="landing-top">
-            <section className="sales-hero">
-              <div className="sales-hero-content">
-                <div className="sales-badge">⚡ Nuovo: AUREO OS Experience</div>
-                <h1>
-                  Il Futuro della <span>Control Room Operativa</span> è qui
-                </h1>
-                <p>
-                  AUREO OS è l’ambiente premium che unisce dashboard, AI, trading, DeFi e sicurezza in un’esperienza elegante, autorevole e pronta a valorizzare il prodotto fin dal primo sguardo.
-                </p>
-                                <div className="sales-hero-buttons">
-                  <button className="btn btn-start btn-large" onClick={openPricingSection}>
-                    Scopri gli step
-                  </button>
-                  <button className="btn btn-outline btn-large" onClick={startTour}>
-                    Guarda il Tour Guidato
-                  </button>
-                </div>
-                <div className="sales-stats-row">
-                  {landingStats.map((item) => (
-                    <div key={item.value} className="sales-stat-item">
-                      <div className="sales-stat-value">{item.value}</div>
-                      <div className="sales-stat-label">{item.label}</div>
-                    </div>
-                  ))}
-                </div>
-              </div>
-
-              <div className="sales-hero-visual">
-                <div className="sales-phone-mockup">
-                  <div className="sales-phone-notch" />
-                  <div className="sales-phone-screen">
-                    <div className="sales-app-header">
-                      <div>
-                        <div className="sales-app-title">AUREO OS</div>
-                        <div className="sales-app-subtitle">Premium Control Room</div>
-                      </div>
-                      <div className="sales-app-balance">$100,900</div>
-                    </div>
-                    <div className="sales-balance-chart">
-                      <div className="sales-chart-line" />
-                    </div>
-                    <div className="sales-bot-status">
-                      <span className="sales-status-dot" />
-                      <span>Sistema attivo • dashboard, AI e security sincronizzati</span>
-                    </div>
-                    {[
-                      { label: 'AI Guided Investment', meta: 'Segnale live • Budget allocato', value: '+$1,240' },
-                      { label: 'DeFi Arbitrage', meta: 'Spread monitorato • 4 venue', value: '+$420' },
-                      { label: 'Security Vault', meta: 'Chiavi protette • accesso biometrico', value: 'SAFE' },
-                    ].map((item) => (
-                      <div key={item.label} className="sales-trade-card">
-                        <div className="sales-trade-info">
-                          <h4>{item.label}</h4>
-                          <span>{item.meta}</span>
-                        </div>
-                        <div className={`sales-trade-profit ${item.value === 'SAFE' ? 'sales-trade-profit--neutral' : ''}`}>{item.value}</div>
-                      </div>
-                    ))}
-                  </div>
-                </div>
-                <div className="sales-float-card sales-float-card--top">
-                  <div className="sales-float-card-header">Signal confidence</div>
-                  <div className="sales-float-card-value">98.2%</div>
-                </div>
-                <div className="sales-float-card sales-float-card--bottom">
-                  <div className="sales-float-card-header">Passkey & secure access</div>
-                  <div className="sales-float-card-value sales-float-card-value--alt">Ready</div>
-                </div>
-                <img src={heroAsset} alt="" className="sales-hero-orb" />
-              </div>
-            </section>
-
-            <section className="sales-section" id="landing-features">
-              <div className="sales-section-header">
-                <h2>Tutto ciò che serve per dare peso al prodotto</h2>
-                <p>La struttura ora segue molto più da vicino la pagina originale: stessi blocchi, stesso ritmo, identità Aureo.</p>
-              </div>
-              <div className="sales-features-grid">
-                {landingFeatures.map((item) => (
-                  <article key={item.title} className="sales-feature-card">
-                    <div className="sales-feature-icon">{item.icon}</div>
-                    <h3>{item.title}</h3>
-                    <p>{item.text}</p>
-                  </article>
-                ))}
-              </div>
-            </section>
-
-            <section className="sales-section sales-section--soft" id="landing-flow">
-              <div className="sales-section-header">
-                <h2>Inizia in 3 semplici passi</h2>
-                <p>Prima percezione, poi scelta, poi accesso: tutto nella stessa esperienza.</p>
-              </div>
-              <div className="sales-steps-container">
-                {landingFlow.map((step) => (
-                  <article key={step.number} className="sales-step">
-                    <div className="sales-step-number">{step.number}</div>
-                    <h3>{step.title}</h3>
-                    <p>{step.text}</p>
-                  </article>
-                ))}
-              </div>
-            </section>
-
-            <section className="sales-section" id="landing-pricing">
-              <div className="sales-section-header">
-                <h2>Scegli lo step perfetto per te</h2>
-                <p>Una sezione piani più vicina alla pagina originale, ma con contenuti Aureo e onboarding già collegato.</p>
-              </div>
-              <div className="sales-pricing-grid">
-                {landingPlans.map((plan) => (
-                  <article key={plan.id} className={`sales-pricing-card ${plan.id === 'pro' ? 'sales-pricing-card--popular' : ''}`}>
-                    {plan.id === 'pro' && <div className="sales-popular-badge">Più richiesto</div>}
-                    <div className="sales-pricing-header">
-                      <h3>{plan.name}</h3>
-                      <div className="sales-price">€{plan.price_monthly}<span>/mese</span></div>
-                      <p>{plan.description}</p>
-                    </div>
-                    <div className="sales-pricing-features">
-                      {plan.features.map((feature) => (
-                        <div key={feature} className="sales-pricing-feature">✓ {feature}</div>
-                      ))}
-                    </div>
-                    <button className="btn btn-start sales-pricing-button" onClick={() => continueWithPlan(plan.id)}>
-                      Continua con {plan.name}
-                    </button>
-                  </article>
-                ))}
-              </div>
-            </section>
-
-            {selectedPlan && (
-              <section className="sales-section sales-section--onboarding" id="landing-plan-onboarding">
-                <div className="sales-inline-plan">
-                  <div className="sales-inline-plan-badge">Percorso selezionato</div>
-                  <h3>{selectedPlan.name}</h3>
-                  <p>{selectedPlan.description}</p>
-                  <div className="sales-inline-plan-price">€{selectedPlan.price_monthly}<span>/mese</span></div>
-                  <div className="sales-inline-plan-features">
-                    {selectedPlan.features.map((feature) => (
-                      <div key={feature} className="sales-inline-plan-feature">✓ {feature}</div>
-                    ))}
-                  </div>
-                </div>
-
-                <form className="sales-inline-form" onSubmit={handleLogin}>
-                  <div className="sales-inline-form-head">
-                    <div className="sales-badge sales-badge--small">Attivazione guidata</div>
-                    <h3>{isRegistering ? `Crea il tuo accesso per ${selectedPlan.name}` : `Accedi per proseguire con ${selectedPlan.name}`}</h3>
-                    <p>
-                      {isRegistering
-                        ? 'Completa qui la registrazione e continua senza uscire dalla pagina.'
-                        : 'Se hai già un account, entra qui sotto e prosegui direttamente con lo step scelto.'}
-                    </p>
-                  </div>
-                  <input
-                    type="email"
-                    placeholder="La tua email"
-                    value={email}
-                    onChange={(e) => setEmail(e.target.value)}
-                    className="sales-input"
-                  />
-                  <input
-                    type="password"
-                    placeholder={isRegistering ? 'Crea una password' : 'Inserisci la tua password'}
-                    value={password}
-                    onChange={(e) => setPassword(e.target.value)}
-                    className="sales-input"
-                  />
-                  {loginError && (
-                    <div className={`sales-form-message ${loginError.toLowerCase().includes('successo') || loginError.toLowerCase().includes('creato') ? 'sales-form-message--success' : ''}`}>
-                      {loginError}
-                    </div>
-                  )}
-                  <button type="submit" className="btn btn-start sales-submit-button">
-                    {isRegistering ? `Crea accesso e continua con ${selectedPlan.name}` : `Accedi e continua con ${selectedPlan.name}`}
-                  </button>
-                  {/*
-                  <button type="button" className="btn btn-outline sales-alt-button" onClick={() => setIsRegistering(!isRegistering)}>
-                    {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
-                  </button>
-                  */}
-                  <button
-                    type="button"
-                    className="btn sales-ghost-button"
-                    onClick={() => {
-                      setSelectedPlanId('');
-                      setIsRegistering(false);
-                      setLoginError('');
-                      setPassword('');
-                      setEmail('');
-                    }}
-                  >
-                    Cambia step
-                  </button>
-                </form>
-              </section>
-            )}
-
-            <section className="sales-section sales-section--proof" id="landing-proof">
-              <div className="sales-section-header">
-                <h2>Recensioni e impressioni</h2>
-                <p>Stessa logica della pagina che mi hai dato: prova sociale, autorevolezza e percezione premium.</p>
-              </div>
-              <div className="sales-testimonials-grid">
-                {landingTestimonials.map((item) => (
-                  <article key={item.name} className="sales-testimonial-card">
-                    <div className="sales-testimonial-header">
-                      <div className="sales-testimonial-avatar">{item.initials}</div>
-                      <div>
-                        <h4>{item.name}</h4>
-                        <span>{item.role}</span>
-                      </div>
-                    </div>
-                    <div className="sales-stars">★★★★★</div>
-                    <p>{item.quote}</p>
-                  </article>
-                ))}
-              </div>
-            </section>
-
-            <section className="sales-cta">
-              <div className="sales-cta-box">
-                <div className="sales-cta-content">
-                  <img src="/aureo-logo.jpg" alt="Aureo OS" className="sales-cta-logo" />
-                  <h2>Porta l’utente dentro un’esperienza che si fa ricordare</h2>
-                  <p>Adesso la landing segue molto più fedelmente il layout originale, ma parla davvero il linguaggio di AUREO OS.</p>
-                  <div className="sales-trust-row">
-                    {landingTrustPillars.map((item) => (
-                      <div key={item} className="sales-trust-pill">{item}</div>
-                    ))}
-                  </div>
-                  <div className="sales-hero-buttons sales-hero-buttons--center">
-                    <button className="btn btn-start btn-large" onClick={openPricingSection}>Vedi gli step</button>
-                    <button className="btn btn-outline btn-large" onClick={() => setShowLanding(false)}>Accedi ora</button>
-                  </div>
-                </div>
-              </div>
-            </section>
-
-            <footer className="sales-footer">
-              <div className="sales-footer-grid">
-                <div className="sales-footer-brand">
-                  <a href="#landing-top" className="sales-logo">
-                    <img src="/aureo-icon.png" alt="Aureo" />
-                    <span>AUREO OS</span>
-                  </a>
-                  <p>Dashboard, AI, trading, DeFi e security in un’unica esperienza premium pensata per controllo, chiarezza e presenza.</p>
-                </div>
-                <div className="sales-footer-links">
-                  <h4>Prodotto</h4>
-                  <a href="#landing-features">Funzionalità</a>
-                  <a href="#landing-pricing">Step</a>
-                </div>
-                <div className="sales-footer-links">
-                  <h4>Esperienza</h4>
-                  <a href="#landing-flow">Percorso</a>
-                  <a href="#landing-proof">Impatto</a>
-                </div>
-                <div className="sales-footer-links">
-                  <h4>Accesso</h4>
-                  <button type="button" className="sales-footer-button" onClick={() => setShowLanding(false)}>Accedi</button>
-                  <button type="button" className="sales-footer-button" onClick={openPricingSection}>Scegli piano</button>
-                </div>
-              </div>
-              <div className="sales-footer-bottom">
-                <span>© 2026 AUREO OS</span>
-                <span>Premium crypto & investment experience</span>
-              </div>
-            </footer>
+          <div className="sales-hero">
+            <h1>Il Futuro della <span>Control Room Operativa</span></h1>
+            <button className="btn btn-start" onClick={openPricingSection}>Scopri Aureo</button>
           </div>
         </div>
       );
     }
-
     return (
       <div className="omni-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
         <div className="card" style={{ textAlign: 'center', width: '400px', padding: '3rem 2rem' }}>
           <img src="/aureo-logo.jpg" alt="AUREO" style={{ maxWidth: '100%', maxHeight: '140px', marginBottom: '1.5rem', objectFit: 'contain' }} />
-          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Ponte di Comando Autenticato</p>
           <form onSubmit={handleLogin}>
             <input 
               type="email" 
-              placeholder={isRegistering ? "La tua Email" : "Email"}
+              placeholder="Email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
-              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
+              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem' }}
             />
             <input 
               type="password" 
-              placeholder={isRegistering ? "Crea una Password" : "Password"}
+              placeholder="Password"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
-              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
+              style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginBottom: '1rem' }}
             />
-            {loginError && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
-            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
-              {isRegistering ? 'CREA ACCOUNT' : 'ACCEDI'}
-            </button>
+            <button type="submit" className="btn btn-start" style={{ width: '100%', padding: '1rem' }}>ACCEDI</button>
           </form>
-          {/* <button
-            type="button"
-            className="btn btn-outline"
-            onClick={() => setIsRegistering(!isRegistering)}
-            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem' }}
-          >
-            {isRegistering ? 'HAI GIÀ UN ACCOUNT? ACCEDI' : 'NON HAI UN ACCOUNT? REGISTRATI'}
-          </button> */}
-          <button
-            type="button"
-            className="btn"
-            onClick={handlePasskeyLogin}
-            disabled={!passkeySupported || passkeyBusy || isRegistering}
-            style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: (passkeySupported && !isRegistering) ? 1 : 0.3 }}
-          >
-            {passkeyBusy ? 'Accesso biometrico…' : 'ACCEDI CON FACE ID / TOUCH ID'}
-          </button>
-          <button type="button" className="btn btn-outline" onClick={enterDemoMode} style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem', fontSize: '0.95rem', opacity: isRegistering ? 0.3 : 1 }}>
-            ENTRA IN DEMO MODE
-          </button>
-          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
-            🔒 Protetto da Crittografia<br/>
-          </div>
+          <button type="button" className="btn btn-outline" onClick={enterDemoMode} style={{ width: '100%', marginTop: '0.9rem', padding: '0.95rem' }}>ENTRA IN DEMO MODE</button>
         </div>
       </div>
     );
   }
 
-  // --- INTERFACCIA AUTENTICATA (ADMIN O USER ATTIVO) ---
   return (
   <ErrorBoundary>
     <div className="omni-app">
       <div className="sidebar">
         <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
-          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
-            <img src="/aureo-icon.png" alt="Aureo Icon" style={{ height: '36px', objectFit: 'contain' }} />
-            <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #d4af37, #f3e5ab)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '2px' }}>
-              AUREO
-            </h1>
-          </div>
-          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.5rem', letterSpacing: '1px', textAlign: 'center' }}>CRYPTO & INVESTMENT TRADING</div>
+          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#d4af37' }}>AUREO</h1>
         </div>
         
         <div className="sidebar-menu">
-          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
-            <span className="menu-icon">📊</span>
-            <span className="menu-label">Dashboard</span>
-          </div>
-          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
-            <span className="menu-icon">📈</span>
-            <span className="menu-label">Trading</span>
-            {status.modules?.trading && <div className="active-dot"></div>}
-          </div>
-          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
-            <span className="menu-icon">⛓️</span>
-            <span className="menu-label">DeFi</span>
-            {status.modules?.crypto_arb && <div className="active-dot"></div>}
-          </div>
-          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
-            <span className="menu-icon">🔐</span>
-            <span className="menu-label">Security</span>
-          </div>
+          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><span className="menu-icon">📊</span><span className="menu-label">Dashboard</span></div>
+          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}><span className="menu-icon">📈</span><span className="menu-label">Trading</span></div>
+          <div className={`menu-item ${activeTab === 'sports_arb' ? 'active' : ''}`} onClick={() => setActiveTab('sports_arb')}><span className="menu-icon">⚽</span><span className="menu-label">Sports</span></div>
+          <div className={`menu-item ${activeTab === 'value_bets' ? 'active' : ''}`} onClick={() => setActiveTab('value_bets')}><span className="menu-icon">🧠</span><span className="menu-label">AI Sentiment</span></div>
+          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><span className="menu-icon">🔐</span><span className="menu-label">Security</span></div>
           {BILLING_ENABLED && userRole === 'admin' && (
-            <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>
-              <span className="menu-icon">💳</span>
-              <span className="menu-label">Billing</span>
-            </div>
+            <div className={`menu-item ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}><span className="menu-icon">💳</span><span className="menu-label">Billing</span></div>
           )}
-          <div className={`menu-item ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
-            <span className="menu-icon">📖</span>
-            <span className="menu-label">Guida Setup</span>
-          </div>
+          <div className={`menu-item ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}><span className="menu-icon">📖</span><span className="menu-label">Guida</span></div>
         </div>
         
         <div className="sidebar-footer">
-          <div>Connesso a server sicuro</div>
-          <div style={{ color: '#10b981', marginTop: '0.2rem' }}>All Systems Nominal</div>
-          <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
-          
-          {userRole === 'user' && (
-            <button className="btn btn-start" onClick={() => setShowPaymentModal(true)} style={{ width: '100%', marginTop: '1rem', fontSize: '1rem', padding: '0.8rem', background: userIsPaid ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)', border: 'none', boxShadow: userIsPaid ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
-              {userIsPaid ? '♻️ Rinnova Abbonamento' : '💎 Sblocca Pro / Paga'}
-            </button>
-          )}
-
-          <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
-            👤 {email}
-          </div>
-
-          <button
-            onClick={handleLogout}
-            className="btn"
-            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
-          >
-            LOGOUT
-          </button>
+          <button onClick={handleLogout} className="btn" style={{ width: '100%' }}>LOGOUT</button>
         </div>
-        
-
       </div>
       
       <div className="main-content">
-        {/* Onboarding Modal */}
-        {showOnboarding && (
-          <OnboardingModal 
-            onClose={() => setShowOnboarding(false)} 
-            onGoToSettings={() => {
-              setShowOnboarding(false);
-              setActiveTab('settings');
-            }}
-          />
-        )}
-
-        {/* Missing Keys Banner */}
-        {(!apiKeys.alpaca_key && !apiKeys.binance_key && userRole !== 'admin' && !isDemoMode) && (
-          <div style={{
-            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
-            color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
-            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
-            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
-          }}>
-            <div>
-              <strong>Azione Richiesta:</strong> Configura le tue API Key per iniziare a operare sui mercati.
-            </div>
-            <button 
-              onClick={() => setActiveTab('settings')}
-              style={{
-                background: '#fff', color: '#d97706', border: 'none', padding: '0.5rem 1rem',
-                borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
-              }}
-            >
-              Vai alle Impostazioni →
-            </button>
-          </div>
-        )}
-
-        {/* Payment Modal */}
-        {showPaymentModal && (
-          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
-            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
-              <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
-              {renderCryptoPaywall()}
-            </div>
-          </div>
-        )}
-
-        {isDemoMode && (
-          <div className="demo-mode-banner">
-            Demo mode attiva — puoi esplorare il prodotto, ma le azioni live sono bloccate.
-          </div>
-        )}
-        <div className="mobile-shell-header">
-          <div>
-            <div className="mobile-shell-kicker">AUREO OS</div>
-            <div className="mobile-shell-title">{activeTabLabel}</div>
-            {isDemoMode && <div className="demo-mode-pill">DEMO MODE</div>}
-            <div className={`sync-pill ${isBackendOnline ? 'online' : 'offline'}`}>{syncLabel}</div>
-          </div>
-          <button onClick={handleLogout} className="btn mobile-shell-action">
-            Logout
-          </button>
-        </div>
         {activeTab === 'home' && renderHomeView()}
         {activeTab === 'settings' && renderSettingsView()}
         {activeTab === 'trading' && renderTradingView()}
-        {activeTab === 'crypto_arb' && renderArbitrageView()}
         {activeTab === 'sports_arb' && renderSportsArbitrageView()}
         {activeTab === 'value_bets' && renderValueBetsView()}
         {activeTab === 'ai_content' && renderAIContentView()}
