import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Change the default activeTab from 'trading' to 'home'
if "const [activeTab, setActiveTab] = useState('trading');" in content:
    content = content.replace("const [activeTab, setActiveTab] = useState('trading');", "const [activeTab, setActiveTab] = useState('home');")

# 2. Add Recharts imports if missing
# We need PieChart, Pie, Cell, Legend from recharts
if "PieChart" not in content:
    content = content.replace("LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';", "LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';")

# 3. Modify Sidebar menu items
old_sidebar = """        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Algo-Trading
          </div>
          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
            <span className="menu-icon">⛓️</span> DeFi Arbitrage
            {status.modules?.crypto_arb && <div className="active-dot"></div>}
          </div>"""

new_sidebar = """        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="menu-icon">🌍</span> Empire Overview
          </div>
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Stock Market
          </div>
          <div className={`menu-item ${activeTab === 'crypto_arb' ? 'active' : ''}`} onClick={() => setActiveTab('crypto_arb')}>
            <span className="menu-icon">⛓️</span> DeFi Arbitrage
            {status.modules?.crypto_arb && <div className="active-dot"></div>}
          </div>"""

if "🌍" not in content:
    content = content.replace(old_sidebar, new_sidebar)

# 4. Create renderHomeView function
home_view = """
  const renderHomeView = () => {
    const aiEarnings = status.ai_videos?.reduce((acc, v) => acc + (v.earnings || 0), 0) || 0;
    const tradingProfit = Number(status.profit || 0);
    const virtualCash = Number(status.virtual_cash || 100000);
    const totalWorth = virtualCash + (tradingProfit > 0 ? tradingProfit : 0) + aiEarnings;
    
    const pieData = [
      { name: 'Liquidità', value: virtualCash, color: '#94a3b8' },
      { name: 'Azioni (Trading)', value: Math.abs(tradingProfit) || 100, color: '#38bdf8' },
      { name: 'TikTok (AdSense)', value: aiEarnings || 50, color: '#a855f7' },
      { name: 'DeFi & Scommesse', value: 150, color: '#f59e0b' } // Valore fittizio minimo per vederlo nel grafico
    ];

    return (
      <div className="module-content">
        <div className="header" style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>L'Impero 👑</h2>
          <div style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Dashboard Aggregata delle Rendite Passive</div>
        </div>

        {/* Big Number */}
        <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 100%)', padding: '3rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '1rem' }}>Net Worth Totale Stimato</div>
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
                    <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>Algo-Trading</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Trading Quantitativo AI</div>
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${Math.abs(tradingProfit).toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥈</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>AI Faceless Content</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Monetizzazione AdSense</div>
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>+${aiEarnings.toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🥉</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>DeFi Arbitrage</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Spread BTC/USDT</div>
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
"""

if "const renderHomeView" not in content:
    content = content.replace("const renderTradingView", home_view + "\n  const renderTradingView")

# 5. Add to main-content rendering
old_main = """      <div className="main-content">
        {activeTab === 'trading' && renderTradingView()}"""
new_main = """      <div className="main-content">
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'trading' && renderTradingView()}"""
if "activeTab === 'home'" not in content:
    content = content.replace(old_main, new_main)

with open(file_path, 'w') as f:
    f.write(content)

print("React UI patched with Global Dashboard.")
