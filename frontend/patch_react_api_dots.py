import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add savedKeys state
if "const [savedKeys, setSavedKeys] = useState({});" not in content:
    content = content.replace("const [testResults, setTestResults] = useState({});", "const [testResults, setTestResults] = useState({});\n  const [savedKeys, setSavedKeys] = useState({});")

# 2. Fetch savedKeys on mount of SettingsView
# Wait, let's just fetch it in useEffect when activeTab === 'settings'
fetch_keys_effect = """
  useEffect(() => {
    if (activeTab === 'settings') {
      const fetchKeys = async () => {
        try {
          const res = await fetch('/api/keys');
          const data = await res.json();
          setSavedKeys(data);
        } catch(err) {
          console.error("Error fetching keys");
        }
      };
      fetchKeys();
    }
  }, [activeTab]);
"""

if "const fetchKeys = async ()" not in content:
    content = content.replace("const renderSettingsView = () => (", fetch_keys_effect + "\n  const renderSettingsView = () => (")

# 3. Add orange dots to titles in renderSettingsView
content = content.replace("<h3 style={{ margin: 0, color: '#e2e8f0' }}>Alpaca (Stock Market)</h3>", 
                          "<h3 style={{ margin: 0, color: '#e2e8f0' }}>Alpaca (Stock Market) {savedKeys['ALPACA_KEY'] && <span title='API Key presente nel Vault'>🟠</span>}</h3>")

content = content.replace("<h3 style={{ margin: 0, color: '#e2e8f0' }}>Binance (Crypto Arb)</h3>", 
                          "<h3 style={{ margin: 0, color: '#e2e8f0' }}>Binance (Crypto Arb) {savedKeys['BINANCE_KEY'] && <span title='API Key presente nel Vault'>🟠</span>}</h3>")

content = content.replace("<h3 style={{ margin: 0, color: '#e2e8f0' }}>Kraken (Crypto Arb)</h3>", 
                          "<h3 style={{ margin: 0, color: '#e2e8f0' }}>Kraken (Crypto Arb) {savedKeys['KRAKEN_KEY'] && <span title='API Key presente nel Vault'>🟠</span>}</h3>")

content = content.replace("<label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>ElevenLabs API (Generazione Voce TikTok)</label>", 
                          "<label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>ElevenLabs API {savedKeys['ELEVENLABS_KEY'] && <span title='API Key presente nel Vault'>🟠</span>}</label>")

content = content.replace("<label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>The-Odds-API (Sports SureBets)</label>", 
                          "<label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>The-Odds-API {savedKeys['THEODDS_KEY'] && <span title='API Key presente nel Vault'>🟠</span>}</label>")

with open(file_path, 'w') as f:
    f.write(content)

print("Added API dots.")
