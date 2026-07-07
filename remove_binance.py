import re

with open("frontend/src/OmniApp.jsx", "r") as f:
    content = f.read()

# 1. apiKeys state
content = re.sub(
    r"const \[apiKeys, setApiKeys\] = useState\(\{alpaca_key:'', alpaca_secret:'', binance_key:'', binance_secret:'', kraken_key:'', kraken_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:''\}\);",
    r"const [apiKeys, setApiKeys] = useState({alpaca_key:'', alpaca_secret:'', elevenlabs_key:'', theodds_key:'', groq_key:'', newsapi_key:'', google_cloud_json:''});",
    content
)

# 2. Onboarding Modal - Binance/Kraken (If it exists)
content = re.sub(
    r"\s*\{\/\*\s*Binance\/Kraken\s*\*\/\}[\s\S]*?Kraken ↗<\/a>\s*<\/div>\s*<\/div>",
    "",
    content
)

# 3. Banner logic: (!apiKeys.alpaca_key && !apiKeys.binance_key ...
content = content.replace(
    "if (!keysData.ALPACA_KEY && !keysData.BINANCE_KEY) {",
    "if (!keysData.ALPACA_KEY) {"
)
content = content.replace(
    "if (!data.ALPACA_KEY && !data.BINANCE_KEY && !data.KRAKEN_KEY) {",
    "if (!data.ALPACA_KEY) {"
)
content = content.replace(
    "{(!apiKeys.alpaca_key && !apiKeys.binance_key && userRole !== 'admin' && !isDemoMode) && (",
    "{(!apiKeys.alpaca_key && userRole !== 'admin' && !isDemoMode) && ("
)
content = content.replace(
    "<p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca/Binance.</p>",
    "<p style={{ margin: 0, opacity: 0.9 }}>Per operare sui mercati finanziari, devi prima inserire le tue chiavi API di Alpaca.</p>"
)

# 4. setApiKeys prepopulation
content = re.sub(
    r"\s*binance_key: data\.BINANCE_KEY \|\| '',\s*binance_secret: data\.BINANCE_SECRET \|\| '',\s*kraken_key: data\.KRAKEN_KEY \|\| '',\s*kraken_secret: data\.KRAKEN_SECRET \|\| '',",
    "",
    content
)

# 5. apiGuides array: remove binance and kraken objects
content = re.sub(
    r"\s*\{\s*id: 'binance',[\s\S]*?note: '⚠️ Non abilitare mai i permessi di prelievo sulle API Key per sicurezza\.',\s*\},",
    "",
    content
)
content = re.sub(
    r"\s*\{\s*id: 'kraken',[\s\S]*?note: 'Kraken è usato in combinazione con Binance per rilevare opportunità di arbitraggio\.',\s*\},",
    "",
    content
)

# 6. guide steps list
content = re.sub(r"\s*\{\s*n: 3, icon: '🟡', name: 'Binance', desc: 'Crypto arb \(richiede KYC\)'\s*\},", "", content)

# 7. UI inputs for Binance and Kraken in Security tab
binance_ui = r"\s*<h3[^>]*>Binance \(Crypto Arb\)[\s\S]*?testResults\['binance'\]\}<\/div>\}"
content = re.sub(binance_ui, "", content)

kraken_ui = r"\s*<h3[^>]*>Kraken \(Crypto Arb\)[\s\S]*?testResults\['kraken'\]\}<\/div>\}"
content = re.sub(kraken_ui, "", content)

with open("frontend/src/OmniApp.jsx", "w") as f:
    f.write(content)
