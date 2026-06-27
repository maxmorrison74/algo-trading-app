import os

css_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/index.css"
with open(css_path, 'a') as f:
    f.write("""

/* OMNI-PROFIT SYSTEM LAYOUT */
.omni-app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #0f172a;
}

.sidebar {
  width: 280px;
  background-color: #1e293b;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 2rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.sidebar-menu {
  flex: 1;
  padding: 1.5rem 0;
  overflow-y: auto;
}

.menu-item {
  padding: 1rem 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  position: relative;
  font-weight: 500;
}

.menu-item:hover {
  background-color: rgba(255,255,255,0.03);
  color: #f8fafc;
}

.menu-item.active {
  background-color: rgba(6, 182, 212, 0.1);
  color: #06b6d4;
  border-right: 3px solid #06b6d4;
}

.menu-icon {
  margin-right: 1rem;
  font-size: 1.2rem;
}

.active-dot {
  width: 8px;
  height: 8px;
  background-color: #10b981;
  border-radius: 50%;
  position: absolute;
  right: 1.5rem;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.sidebar-footer {
  padding: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  font-size: 0.8rem;
  color: #64748b;
}

.main-content {
  flex: 1;
  padding: 2.5rem 3rem;
  overflow-y: auto;
}

.module-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
""")

print("CSS added.")
