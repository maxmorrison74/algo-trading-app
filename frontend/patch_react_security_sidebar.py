import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# I will use a simple split and insert logic instead of exact match for the whole block.
search_str = "<span className=\"menu-icon\">💳</span> SaaS & Billing\n          </div>\n        </div>"

replacement = """<span className="menu-icon">💳</span> SaaS & Billing
          </div>
          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="menu-icon">🔐</span> Security & API
          </div>
        </div>"""

if "Security & API" not in content and search_str in content:
    content = content.replace(search_str, replacement)
elif "Security & API" not in content:
    # Let's try another search string
    search_str2 = "SaaS & Billing\n          </div>\n        </div>"
    replacement2 = """SaaS & Billing
          </div>
          <div className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="menu-icon">🔐</span> Security & API
          </div>
        </div>"""
    content = content.replace(search_str2, replacement2)

with open(file_path, 'w') as f:
    f.write(content)

print("Security Sidebar patched.")
