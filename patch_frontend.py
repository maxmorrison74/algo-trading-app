import sys

FRONTEND_PATH = "frontend/src/OmniApp.jsx"
with open(FRONTEND_PATH, "r") as f:
    content = f.read()

components = """
// --- NEW COMPONENTS ---
const RiskStatus = () => {
  const [risk, setRisk] = useState(null);
  
  useEffect(() => {
    const fetchRisk = () => fetch('/api/risk/status').then(r => r.json()).then(setRisk).catch(e => console.error(e));
    fetchRisk();
    const interval = setInterval(fetchRisk, 5000);
    return () => clearInterval(interval);
  }, []);
  
  if (!risk) return <div className="card col-span-12">Caricamento Risk Manager...</div>;
  
  const statusColors = {
    green: '#10B981',
    yellow: '#F59E0B', 
    red: '#EF4444',
    black: '#000000'
  };
  
  return (
    <div className="card col-span-6" style={{ border: `2px solid ${statusColors[risk.status]}` }}>
      <div className="card-title">🛡️ Risk Manager</div>
      <div style={{color: statusColors[risk.status], fontSize: '1.5rem', fontWeight: 'bold'}}>
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
          onClick={() => fetch('/api/risk/emergency-stop', {method: 'POST'})}
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
    const fetchCap = () => fetch('/api/capital/status').then(r => r.json()).then(setCapital).catch(e => console.error(e));
    fetchCap();
    const interval = setInterval(fetchCap, 5000);
    return () => clearInterval(interval);
  }, []);
  
  if (!capital) return <div className="card col-span-12">Caricamento Capital Manager...</div>;
  
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
          onClick={() => fetch('/api/capital/advance', {method: 'POST'})}
          style={{ background: '#10B981', color: 'white', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', width: '100%', cursor: 'pointer' }}
        >
          🚀 AVANZA FASE
        </button>
      )}
    </div>
  );
};
// ----------------------
"""

if "const RiskStatus" not in content:
    # Insert before export default function OmniApp
    content = content.replace("export default function OmniApp", components + "\nexport default function OmniApp")

# Insert them into the layout, below the main dashboard grid
dashboard_injection = """
      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
        <RiskStatus />
        <CapitalPhase />
      </div>
"""
if "<RiskStatus />" not in content:
    content = content.replace(
        "      <div className=\"chart-controls\"",
        dashboard_injection + "\n      <div className=\"chart-controls\""
    )

with open(FRONTEND_PATH, "w") as f:
    f.write(content)

print("FRONTEND PATCHED!")
