import re
import os

with open("backend/api.py", "r") as f:
    content = f.read()

# 1. DB Functions
content = content.replace('DB_FILE = "bot_db.json"', 'DB_FILE_PREFIX = "bot_db"')
content = content.replace('def load_db():\n    with db_lock:\n        if os.path.exists(DB_FILE):\n            try:\n                with open(DB_FILE, "r") as f:',
'''def get_db_file(user_id=None):
    if not user_id or user_id == "admin":
        return f"{DB_FILE_PREFIX}.json"
    return f"{DB_FILE_PREFIX}_{user_id}.json"

def load_db(user_id=None):
    with db_lock:
        file_path = get_db_file(user_id)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r") as f:''')
content = content.replace('def save_db(state_dict):\n    with db_lock:\n        with open(DB_FILE, "w") as f:\n            json.dump(state_dict, f)',
'''def save_db(state_dict, user_id=None):
    with db_lock:
        file_path = get_db_file(user_id)
        with open(file_path, "w") as f:
            json.dump(state_dict, f, indent=4)''')

# 2. BotState
content = content.replace('class BotState:\n    def __init__(self):\n        db_data = load_db()',
'''class BotState:
    def __init__(self, user_id=None):
        self.user_id = user_id
        db_data = load_db(user_id)''')
content = content.replace('def save_state(self):\n        save_db({\n            "virtual_cash": self.virtual_cash,\n            "logs": self.logs,\n            "aggressiveness": self.aggressiveness,\n            "auto_bet_enabled": self.auto_bet_enabled,\n            "auto_bet_threshold": self.auto_bet_threshold,\n            "trade_history": self.trade_history,\n            "ai_investments": self.ai_investments,\n            "high_watermarks": self.high_watermarks,\n            "modules": self.modules,\n            "target_symbols": self.target_symbols,\n            "symbol_selection": self.symbol_selection,\n        })',
'''def save_state(self):
        save_db({
            "virtual_cash": self.virtual_cash,
            "logs": self.logs,
            "aggressiveness": self.aggressiveness,
            "auto_bet_enabled": self.auto_bet_enabled,
            "auto_bet_threshold": self.auto_bet_threshold,
            "trade_history": self.trade_history,
            "ai_investments": self.ai_investments,
            "high_watermarks": self.high_watermarks,
            "modules": self.modules,
            "target_symbols": self.target_symbols,
            "symbol_selection": self.symbol_selection,
        }, self.user_id)''')

# 3. Global engines
content = content.replace('alpaca_engine = AlpacaEngine(bot_state)\ntrade_lock = threading.Lock()',
'''user_bot_states = {}
user_engines = {}

def get_user_bot_state(user_id="admin"):
    if user_id not in user_bot_states:
        user_bot_states[user_id] = BotState(user_id)
        if not user_bot_states[user_id].target_symbols:
            user_bot_states[user_id].target_symbols = DEFAULT_TARGET_SYMBOLS[:]
    return user_bot_states[user_id]

def get_user_alpaca_engine(user_id="admin"):
    if user_id not in user_engines:
        state = get_user_bot_state(user_id)
        engine = AlpacaEngine(state)
        engine.init_clients(user_id)
        user_engines[user_id] = engine
    return user_engines[user_id]

admin_bot_state = get_user_bot_state("admin")
alpaca_engine = get_user_alpaca_engine("admin")
trade_lock = threading.Lock()''')

# 4. status endpoints
content = content.replace('def get_status():\n    if not alpaca: return {"error": "Alpaca API non configurata."}',
'''def get_status(user_id="admin"):
    bot_state = get_user_bot_state(user_id)
    alpaca = get_user_alpaca_engine(user_id).alpaca_rest
    alpaca_connected = alpaca is not None
    #if not alpaca: return {"error": "Alpaca API non configurata."}''')
content = content.replace('"symbol_selection": getattr(bot_state, "symbol_selection", {}),',
'"symbol_selection": getattr(bot_state, "symbol_selection", {}),\n            "alpaca_connected": alpaca_connected,')

content = content.replace('''@app.get("/api/status")
def api_status(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    try:
        return get_status()''',
'''@app.get("/api/status")
def api_status(response: Response, request: Request):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    user_id = "admin"
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub", "admin")
        except: pass
    try:
        return get_status(user_id)''')

# 5. Fix endpoints with global alpaca
content = content.replace('''def get_stock_quote(symbol: str):
    """Restituisce la quotazione in tempo reale tramite Alpaca (o yfinance come fallback)."""
    symbol = symbol.upper().strip()
    try:
        import alpaca_trade_api as tradeapi
        # Prova con Alpaca prima se configurata
        global alpaca
        if alpaca:
            bar = alpaca.get_latest_trade(symbol)''',
'''def get_stock_quote(symbol: str, user_id: str = "admin"):
    """Restituisce la quotazione in tempo reale tramite Alpaca (o yfinance come fallback)."""
    symbol = symbol.upper().strip()
    try:
        alpaca = get_user_alpaca_engine(user_id).alpaca_rest
        if alpaca:
            bar = alpaca.get_latest_trade(symbol)''')

content = content.replace('''@app.post("/api/stock/trade/manual")
def manual_stock_trade(payload: dict, _: str = Depends(require_admin)):''',
'''@app.post("/api/stock/trade/manual")
def manual_stock_trade(payload: dict, req: Request, _: str = Depends(require_admin)):
    user_id = "admin"
    auth = req.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            tok = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = tok.get("sub", "admin")
        except: pass''')

content = content.replace('quote = get_stock_quote(symbol)', 'quote = get_stock_quote(symbol, user_id)')

content = content.replace('''@app.post("/api/stop")
def stop_bot(_: str = Depends(require_admin)):
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")''',
'''@app.post("/api/stop")
def stop_bot(req: Request, _: str = Depends(require_admin)):
    user_id = "admin"
    auth = req.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            tok = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = tok.get("sub", "admin")
        except: pass
    alpaca = get_user_alpaca_engine(user_id).alpaca_rest
    bot_state = get_user_bot_state(user_id)
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")''')

content = content.replace('''@app.post("/api/reset")
def reset_simulation(_: str = Depends(require_admin)):
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")''',
'''@app.post("/api/reset")
def reset_simulation(req: Request, _: str = Depends(require_admin)):
    user_id = "admin"
    auth = req.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            tok = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = tok.get("sub", "admin")
        except: pass
    alpaca = get_user_alpaca_engine(user_id).alpaca_rest
    bot_state = get_user_bot_state(user_id)
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")''')

content = content.replace('elif alpaca:\n                    import alpaca_trade_api as tradeapi',
'''elif get_user_alpaca_engine("admin").alpaca_rest:
                    alpaca = get_user_alpaca_engine("admin").alpaca_rest
                    import alpaca_trade_api as tradeapi''')

with open("backend/api.py", "w") as f:
    f.write(content)
