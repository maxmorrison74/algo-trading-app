import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

old_sidebar = """        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Algo-Trading
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>"""

new_sidebar = """        <div className="sidebar-menu">
          <div className={`menu-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <span className="menu-icon">🌍</span> Empire Overview
          </div>
          <div className={`menu-item ${activeTab === 'trading' ? 'active' : ''}`} onClick={() => setActiveTab('trading')}>
            <span className="menu-icon">📈</span> Stock Market
            {status.modules?.trading && <div className="active-dot"></div>}
          </div>"""

if "🌍" not in content:
    content = content.replace(old_sidebar, new_sidebar)

with open(file_path, 'w') as f:
    f.write(content)

print("Sidebar patched.")
