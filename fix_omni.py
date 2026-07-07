import re

with open("frontend/src/OmniApp.jsx", "r") as f:
    content = f.read()

# Remove crypto_arb from TAB_TITLES
content = re.sub(r"\s*crypto_arb:\s*'DeFi Arbitrage',", "", content)

# Remove defi from billing modules
content = re.sub(r"modules:\s*\['dashboard',\s*'trading',\s*'defi',\s*'sentiment'\]", "modules: ['dashboard', 'trading', 'sentiment']", content)
content = re.sub(r"modules:\s*\['dashboard',\s*'trading',\s*'defi',\s*'sentiment',\s*'ai_content',\s*'billing'\]", "modules: ['dashboard', 'trading', 'sentiment', 'ai_content', 'billing']", content)

# Remove Binance/Kraken from onboarding (approx lines 318-330)
kraken_block = r"\s*\{\/\*\s*Binance\/Kraken\s*\*\/\}[\s\S]*?Crea API Kraken ↗<\/a>\s*<\/div>\s*<\/div>"
content = re.sub(kraken_block, "", content)

# Remove DeFi menu item
defi_menu = r"\s*<div className=\{\`menu-item \$\{activeTab === 'crypto_arb' \? 'active' : ''\}\`\} onClick=\{.*?\}\s*>\s*<span className=\"menu-icon\">⛓️<\/span>\s*<span className=\"menu-label\">DeFi<\/span>\s*\{status\.modules\?\.crypto_arb && <div className=\"active-dot\"><\/div>\}\s*<\/div>"
content = re.sub(defi_menu, "", content)

# Remove renderArbitrageView call
content = re.sub(r"\s*\{activeTab === 'crypto_arb' && renderArbitrageView\(\)\}", "", content)

# Remove renderArbitrageView function definition
render_fn_pattern = r"\s*const renderArbitrageView = \(\) => \{[\s\S]*?(?=const renderSportsArbitrageView = \(\) => \{)"
content = re.sub(render_fn_pattern, "\n\n  ", content)

with open("frontend/src/OmniApp.jsx", "w") as f:
    f.write(content)
