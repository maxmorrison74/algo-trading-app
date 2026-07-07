import re
with open("backend/api.py", "r") as f:
    content = f.read()

# Update SaveKeysRequest model
req_model = """class SaveKeysRequest(BaseModel):
    alpaca_key: str = ""
    alpaca_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""
    groq_key: str = ""
    newsapi_key: str = ""
    google_cloud_json: str = ""
    trailing_stop_base_pct: float = 2.5
    dynamic_atr_stop: bool = True
"""
content = re.sub(r"class SaveKeysRequest\(BaseModel\):[\s\S]*?google_cloud_json: str = \"\"", req_model, content)

# Update GET /api/keys to return the fields
get_keys = """            "GROQ_KEY": keys.get("GROQ_KEY", ""),
            "NEWSAPI_KEY": keys.get("NEWSAPI_KEY", ""),
            "TRAILING_STOP_BASE_PCT": float(keys.get("TRAILING_STOP_BASE_PCT", 2.5)),
            "DYNAMIC_ATR_STOP": str(keys.get("DYNAMIC_ATR_STOP", "True")).lower() == "true",
            "ERROR": ""
"""
content = re.sub(r"\s*\"GROQ_KEY\": keys\.get\(\"GROQ_KEY\", \"\"\),\s*\"NEWSAPI_KEY\": keys\.get\(\"NEWSAPI_KEY\", \"\"\),\s*\"ERROR\": \"\"", get_keys, content)

# Update POST /api/keys to save the fields
save_keys = """    if req.groq_key and "***" not in req.groq_key: keys['GROQ_KEY'] = req.groq_key
    if req.newsapi_key and "***" not in req.newsapi_key: keys['NEWSAPI_KEY'] = req.newsapi_key
    
    keys['TRAILING_STOP_BASE_PCT'] = str(req.trailing_stop_base_pct)
    keys['DYNAMIC_ATR_STOP'] = str(req.dynamic_atr_stop)
"""
content = re.sub(r"\s*if req\.groq_key and \"\*\*\*\" not in req\.groq_key: keys\['GROQ_KEY'\] = req\.groq_key\s*if req\.newsapi_key and \"\*\*\*\" not in req\.newsapi_key: keys\['NEWSAPI_KEY'\] = req\.newsapi_key", save_keys, content)

with open("backend/api.py", "w") as f:
    f.write(content)
