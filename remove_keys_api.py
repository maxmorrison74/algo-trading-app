import re

with open("backend/api.py", "r") as f:
    content = f.read()

# Remove fields from SaveKeysRequest
content = re.sub(r"\s*binance_key: str = \"\"\s*binance_secret: str = \"\"\s*kraken_key: str = \"\"\s*kraken_secret: str = \"\"", "", content)

# Remove test connection logic for binance
content = re.sub(r"\s*elif req\.exchange == 'binance':[\s\S]*?return \{\"status\": \"success\", \"message\": \"Binance API Key e Secret valide!\"\}", "", content)

# Remove test connection logic for kraken
content = re.sub(r"\s*elif req\.exchange == 'kraken':[\s\S]*?return \{\"status\": \"success\", \"message\": \"Kraken API Key e Secret valide!\"\}", "", content)

with open("backend/api.py", "w") as f:
    f.write(content)
