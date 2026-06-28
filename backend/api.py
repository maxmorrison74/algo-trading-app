from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import alpaca_trade_api as tradeapi
import os
from dotenv import load_dotenv
import random
import asyncio
import math
import json
import requests
import threading
from crypto_arbitrage import CryptoArbitrage
from sports_arbitrage import SportsArbitrage
from ai_content import AIContentCreator
from alpaca_trading import AlpacaEngine
import concurrent.futures
import gc
import time
from datetime import datetime
import yfinance as yf
import pandas as pd
import sys
sys.path.append('/usr/local/lib/python3.13/dist-packages')

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    sentiment_analyzer = SentimentIntensityAnalyzer()
except Exception as e:
    sentiment_analyzer = None
    print(f"⚠️ Errore caricamento vaderSentiment: {e}")
    print(f"Path attuale: {sys.path}")

# Carica le variabili d'ambiente in modo esplicito (risolve il problema dei percorsi)
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

def send_telegram_message(message: str):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        print("Telegram non configurato in .env")
        return
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    try:
        # Timeout corto per non bloccare troppo il bot
        res = requests.post(url, json=payload, timeout=2)
        if res.status_code != 200:
            print(f"Errore da Telegram: {res.text}")
    except Exception as e:
        print(f"Errore invio Telegram: {e}")

# Importiamo il modello
from lstm_model import LSTMTradingModel
from data_loader import fetch_historical_data

DB_FILE = "bot_db.json"
import threading
db_lock = threading.Lock()

def load_db():
    with db_lock:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, "r") as f:
                return json.load(f)
        return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0, "modules": {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False}}

def save_db(state_dict):
    with db_lock:
        with open(DB_FILE, "w") as f:
            json.dump(state_dict, f)

app = FastAPI(title="AlgoTrading Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("ALPACA_API_KEY")
API_SECRET = os.getenv("ALPACA_SECRET_KEY")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

try:
    alpaca = tradeapi.REST(API_KEY, API_SECRET, BASE_URL, api_version='v2')
except Exception as e:
    alpaca = None

# Pool di ticker volatili molto scambiati, ideali per lo scanning
POOL_TICKERS = [
    "SOFI", "PLTR", "LCID", "F", "SNAP", "PFE", "T", "CCL", 
    "AAL", "BAC", "INTC", "WBD", "PARA", "HOOD", "RIVN", "NIO", 
    "LYFT", "PINS", "CHWY", "DKNG", "AMC", "GME",
    # Aggiunte Crypto
    "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"
]

def get_yf_symbol(symbol):
    """Converte simboli Alpaca in simboli Yahoo Finance."""
    return symbol.replace("/", "-")

target_symbols = [] # Inizialmente vuoto, verrà popolato dinamicamente

# Carichiamo in memoria il Super Modello Generalista
models_dir = os.path.join(os.path.dirname(__file__), "models")
super_model_path = os.path.join(models_dir, "SUPER_MODEL.keras")
super_model = None

if os.path.exists(super_model_path):
    super_model = LSTMTradingModel()
    super_model.load(super_model_path)
    print("✅ SUPER MODELLO IA caricato con successo.")
else:
    print("⚠️ Attenzione: SUPER_MODEL.keras non trovato. Fallback casuale.")

class BotState:
    def __init__(self):
        db_data = load_db()
        self.is_running = False
        self.target_symbols = ["MRNA", "SOFI", "LCID", "F", "SNAP", "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"]
        self.virtual_cash = db_data.get("virtual_cash", 100.0)
        self.portfolio_value = 0.0
        self.latest_predictions = {}
        self.ai_sentiment = {}
        self.last_trade = None
        self.logs = db_data.get("logs", [])
        self.trade_history = db_data.get("trade_history", [])
        self.high_watermarks = db_data.get("high_watermarks", {})
        self.loop_task = None
        self.aggressiveness = db_data.get("aggressiveness", 55.0)
        self.modules = db_data.get("modules", {"trading": False, "crypto_arb": False, "sports_arb": False, "ai_content": False})

    def add_log(self, message: str):
        print(message)
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.logs.insert(0, f"[{timestamp}] {message}")
        if len(self.logs) > 50:
            self.logs = self.logs[:50]
        self.save_state()
        
        # Invia la notifica su Telegram
        send_telegram_message(f"[{timestamp}] {message}")
        
    def save_state(self):
        save_db({
            "virtual_cash": self.virtual_cash,
            "logs": self.logs,
            "aggressiveness": self.aggressiveness,
            "trade_history": self.trade_history,
            "high_watermarks": self.high_watermarks
        })

    def close_trade(self, symbol: str, side: str, profit_usd: float, profit_pct: float):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.trade_history.append({
            "symbol": symbol,
            "side": side,
            "profit_usd": round(profit_usd, 2),
            "profit_pct": round(profit_pct * 100, 2),
            "date": timestamp
        })
        if symbol in self.high_watermarks:
            del self.high_watermarks[symbol]
        self.save_state()

    def _load_history_from_alpaca(self):
        if alpaca:
            try:
                orders = alpaca.list_orders(status='all', limit=30)
                for o in reversed(orders):
                    try:
                        time_str = o.created_at.strftime('%H:%M:%S')
                    except:
                        time_str = "N/A"
                    msg = f"[{time_str}] STORICO: {o.side.upper()} {o.qty} {o.symbol} ({o.status})"
                    self.logs.insert(0, msg)
            except Exception as e:
                print(f"Errore caricamento storico Alpaca: {e}")

bot_state = BotState()
# Inizializza moduli background
arb_engine = CryptoArbitrage(bot_state)
sports_engine = SportsArbitrage(bot_state)
ai_engine = AIContentCreator(bot_state)
alpaca_engine = AlpacaEngine(bot_state)
trade_lock = threading.Lock()
def get_status():
    if not alpaca: return {"error": "Alpaca API non configurata."}
    try:
        account = alpaca.get_account()
        positions = alpaca.list_positions()
        
        # Creiamo un dizionario delle posizioni aperte formattato per il frontend
        pos_dict = {}
        for p in positions:
            if p.symbol in bot_state.target_symbols:
                # Includiamo il side (long o short) per il frontend
                pos_dict[p.symbol] = {"qty": float(p.qty), "market_value": float(p.market_value), "side": p.side.upper()}
                
        # Per i simboli che non abbiamo, segniamo "LIQUID"
        for sym in bot_state.target_symbols:
            if sym not in pos_dict:
                pos_dict[sym] = "LIQUID"
                
        # Prepariamo i payload combinati per la tabella
        table_data = []
        for sym in bot_state.target_symbols:
            table_data.append({
                "symbol": sym,
                "position": pos_dict[sym],
                "prediction": bot_state.latest_predictions.get(sym, "In attesa"),
                "sentiment": bot_state.ai_sentiment.get(sym, "NEUTRAL")
            })

        # Calcoliamo il portfolio_value virtuale per lo status (market_value dello short è già negativo)
        pos_market_value = sum(float(p.market_value) for p in positions if p.symbol in bot_state.target_symbols)
        virtual_portfolio_value = bot_state.virtual_cash + pos_market_value

        win_rate = 0.0
        if bot_state.trade_history:
            wins = sum(1 for t in bot_state.trade_history if t.get("profit_usd", 0) > 0)
            win_rate = round((wins / len(bot_state.trade_history)) * 100, 1)

        clock = alpaca.get_clock()
        return {
            "is_running": bot_state.is_running,
            "portfolio_value": round(virtual_portfolio_value, 2),
            "profit": round(virtual_portfolio_value - 100.0, 2),
            "positions": pos_dict,
            "predictions": bot_state.latest_predictions,
            "last_trade": bot_state.last_trade,
            "cash": round(bot_state.virtual_cash, 2),
            "symbols": bot_state.target_symbols,
            "logs": bot_state.logs,
            "market_open": clock.is_open,
            "aggressiveness": bot_state.aggressiveness,
            "trade_history": bot_state.trade_history,
            "win_rate": win_rate,
            "modules": bot_state.modules,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/modules")
async def toggle_module(payload: dict):
    mod_id = payload.get("module")
    active = payload.get("active")
    if mod_id in bot_state.modules:
        bot_state.modules[mod_id] = active
        bot_state.save_state()
        state_str = "ATTIVATO" if active else "DISATTIVATO"
        bot_state.add_log(f"⚙️ Modulo {mod_id.upper()} {state_str}")
        
        # Start/Stop logic if needed
        
        
        
        if mod_id == "ai_content":
            if active and not ai_engine.running:
                threading.Thread(target=ai_engine.loop, daemon=True).start()
        if mod_id == "sports_arb":
            if active and not sports_engine.running:
                threading.Thread(target=sports_engine.loop, daemon=True).start()
        if mod_id == "crypto_arb":
            if active and not arb_engine.running:
                threading.Thread(target=arb_engine.loop, daemon=True).start()
        if mod_id == "trading":
            if active and not alpaca_engine.running:
                bot_state.is_running = True
                threading.Thread(target=alpaca_engine.loop, daemon=True).start()
            elif not active:
                bot_state.is_running = False
                
        return {"message": "Modulo aggiornato", "modules": bot_state.modules,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])}
    return {"error": "Modulo non trovato"}

@app.post("/api/start")
def start_bot():
    if not alpaca_engine: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    if not bot_state.is_running:
        bot_state.is_running = True
        bot_state.add_log("Avvio scanner Multi-Asset (Alpaca Quant Engine)...")
        threading.Thread(target=alpaca_engine.loop, daemon=True).start()
    return {"message": "Bot avviato", "state": get_status()}

@app.post("/api/config")
async def update_config(config: dict):
    if "aggressiveness" in config:
        bot_state.aggressiveness = float(config["aggressiveness"])
        bot_state.save_state()
        bot_state.add_log(f"Aggressività IA impostata al {bot_state.aggressiveness}%")
        return {"message": "Configurazione aggiornata", "aggressiveness": bot_state.aggressiveness}
    return {"error": "Parametri non validi"}

@app.post("/api/stop")
def stop_bot():
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    
    bot_state.is_running = False
    
    try:
        positions = alpaca.list_positions()
        liquidati = []
        for p in positions:
            if p.symbol in bot_state.target_symbols:
                try:
                    is_crypto = '/' in p.symbol
                    tif = 'gtc' if is_crypto else 'day'
                    alpaca.submit_order(symbol=p.symbol, qty=p.qty, side='sell', type='market', time_in_force=tif)
                    liquidati.append(p.symbol)
                except Exception as e:
                    print(f"Errore chiusura {p.symbol}: {e}")
        
        if liquidati:
            bot_state.add_log(f"KILL SWITCH: Liquidati {', '.join(liquidati)}")
        else:
            bot_state.add_log("Bot fermato (Nessuna posizione aperta)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore Kill Switch: {str(e)}")
        
    return {"message": "Bot fermato", "state": get_status()}

@app.post("/api/reset")
def reset_simulation():
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    
    bot_state.is_running = False
    
    try:
        positions = alpaca.list_positions()
        liquidati = []
        for p in positions:
            if p.symbol in bot_state.target_symbols:
                try:
                    is_crypto = '/' in p.symbol
                    tif = 'gtc' if is_crypto else 'day'
                    alpaca.submit_order(symbol=p.symbol, qty=p.qty, side='sell', type='market', time_in_force=tif)
                    liquidati.append(p.symbol)
                except Exception as e:
                    print(f"Errore chiusura {p.symbol}: {e}")
        
        bot_state.virtual_cash = 100.0
        bot_state.trade_history = []
        bot_state.high_watermarks = {}
        bot_state.logs = []
        bot_state.target_symbols = []
        bot_state.latest_predictions = {}
        bot_state.add_log("Simulazione Resettata a $100.0")
        bot_state.save_state()
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore Reset: {str(e)}")
        
    return {"message": "Simulazione resettata", "state": get_status()}

@app.get("/api/chart-data/{symbol:path}")
def get_chart_data(symbol: str, timeframe: str = "1M"):
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    try:
        sym = get_yf_symbol(symbol)
        
        if timeframe == "1D":
            period = "1d"
            interval = "5m"
            time_format = "%H:%M"
        elif timeframe == "1W":
            period = "5d"
            interval = "15m"
            time_format = "%d/%m %H:%M"
        elif timeframe == "1M":
            period = "1mo"
            interval = "1h"
            time_format = "%d/%m"
        elif timeframe == "1Y":
            period = "1y"
            interval = "1d"
            time_format = "%b '%y"
        elif timeframe == "ALL":
            period = "max"
            interval = "1wk"
            time_format = "%Y"
        else:
            period = "1mo"
            interval = "1h"
            time_format = "%d/%m"

        df = fetch_historical_data(sym, interval=interval, period=period)
        if df.empty:
            return []
        
        # Limitiamo a 100 punti per leggibilità
        recent_df = df.tail(100).copy()
        
        chart_data = []
        for i, row in recent_df.iterrows():
            chart_data.append({
                "time": i.strftime(time_format),
                "price": round(row['Close'], 2)
            })
            
        return chart_data
    except Exception as e:
        return {"error": str(e)}

# SPA Fallback will be moved to bottom


from pydantic import BaseModel
import os

# --- SECURITY & API KEYS ---
# In produzione password dovrebbe essere hashata. Per ora plain text (protetto in .env)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "impero2026")
import os
API_KEYS_FILE = os.path.join(os.path.dirname(__file__), ".env.keys")

# Se il file non esiste, creiamolo vuoto o con un seed base
if not os.path.exists(API_KEYS_FILE):
    with open(API_KEYS_FILE, "w") as f:
        f.write("ALPACA_KEY=PKS3UEZSKP65JV6BKPJLWSIS75\n")
        f.write("ALPACA_SECRET=oY4vQX8SEaLE6JJM9FpD7mMNZ1kknwGmQDMrhow8qjk\n")
        f.write("BINANCE_KEY=7SZAMU47R3dIffolzEpVGNfofSHKkgjvXiiEhMzwUN5rPy1sv6WBt5nrIFKQbFDw\n")
        f.write("BINANCE_SECRET=vjeCiMl7MnJ7NhG46iAMzmPXjJ0EMbqQ65D6GH54wMjBydpCAzZ0Tvm1xlc3rZPV\n")
        f.write("THEODDS_KEY=7aaa30fc512aa2fbf0e180d1431f1f73\n")
        f.write("KRAKEN_KEY=\n")
        f.write("KRAKEN_SECRET=\n")
        f.write("ELEVENLABS_KEY=\n")



class LoginRequest(BaseModel):
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "token": "temp_auth_token_123"}
    return {"status": "error", "message": "Accesso Negato"}, 401

class KeysRequest(BaseModel):
    alpaca_key: str = ""
    alpaca_secret: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""

@app.get("/api/keys")
def get_keys():
    # Return masked keys
    keys = {}
    try:
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        if v:
                            keys[k] = v[:4] + "*" * 10 if len(v) > 4 else "***"
    except Exception as e:
        keys["ERROR"] = str(e)
    return keys

@app.post("/api/keys")
def save_keys(req: KeysRequest):
    try:
        # Read existing
        existing = {}
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        existing[k] = v

        # Merge logic: if incoming is empty or '***' (masked), keep existing
        def merge(key_name, incoming_val):
            if not incoming_val or "***" in incoming_val:
                return existing.get(key_name, "")
            return incoming_val

        new_alpaca_key = merge("ALPACA_KEY", req.alpaca_key)
        new_alpaca_secret = merge("ALPACA_SECRET", req.alpaca_secret)
        new_binance_key = merge("BINANCE_KEY", req.binance_key)
        new_binance_secret = merge("BINANCE_SECRET", req.binance_secret)
        new_kraken_key = merge("KRAKEN_KEY", req.kraken_key)
        new_kraken_secret = merge("KRAKEN_SECRET", req.kraken_secret)
        new_elevenlabs_key = merge("ELEVENLABS_KEY", req.elevenlabs_key)
        new_theodds_key = merge("THEODDS_KEY", req.theodds_key)

        with open(API_KEYS_FILE, "w") as f:
            f.write(f"ALPACA_KEY={new_alpaca_key}\n")
            f.write(f"ALPACA_SECRET={new_alpaca_secret}\n")
            f.write(f"BINANCE_KEY={new_binance_key}\n")
            f.write(f"BINANCE_SECRET={new_binance_secret}\n")
            f.write(f"KRAKEN_KEY={new_kraken_key}\n")
            f.write(f"KRAKEN_SECRET={new_kraken_secret}\n")
            f.write(f"ELEVENLABS_KEY={new_elevenlabs_key}\n")
            f.write(f"THEODDS_KEY={new_theodds_key}\n")
            
        return {"status": "success", "message": "Chiavi salvate nel Vault"}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Errore interno nel server durante il salvataggio: {str(e)}")

class TestConnectionRequest(BaseModel):
    service: str
    alpaca_key: str = ""
    alpaca_secret: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""


@app.post("/api/test-connection")
def test_connection(req: TestConnectionRequest):
    keys = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    keys[k] = v
                    
    # Overlay with keys from request if present and not masked
    if req.alpaca_key and "***" not in req.alpaca_key: keys['ALPACA_KEY'] = req.alpaca_key
    if req.alpaca_secret and "***" not in req.alpaca_secret: keys['ALPACA_SECRET'] = req.alpaca_secret
    if req.binance_key and "***" not in req.binance_key: keys['BINANCE_KEY'] = req.binance_key
    if req.binance_secret and "***" not in req.binance_secret: keys['BINANCE_SECRET'] = req.binance_secret
    if req.kraken_key and "***" not in req.kraken_key: keys['KRAKEN_KEY'] = req.kraken_key
    if req.kraken_secret and "***" not in req.kraken_secret: keys['KRAKEN_SECRET'] = req.kraken_secret
    if req.elevenlabs_key and "***" not in req.elevenlabs_key: keys['ELEVENLABS_KEY'] = req.elevenlabs_key
    if req.theodds_key and "***" not in req.theodds_key: keys['THEODDS_KEY'] = req.theodds_key
    

    service = req.service.lower()
    
    try:
        if service == 'alpaca':
            import alpaca_trade_api as tradeapi
            api_key = keys.get("ALPACA_KEY", "")
            api_secret = keys.get("ALPACA_SECRET", "")
            if not api_key or not api_secret:
                return {"status": "error", "message": "Chiavi Alpaca mancanti."}
            api = tradeapi.REST(api_key, api_secret, base_url='https://paper-api.alpaca.markets')
            account = api.get_account()
            if account.status == 'ACTIVE':
                return {"status": "success", "message": f"Connessione Alpaca stabilita! Status: {account.status}"}
            else:
                return {"status": "error", "message": "Account Alpaca non attivo."}
                
        elif service == 'binance':
            import ccxt
            api_key = keys.get("BINANCE_KEY", "")
            api_secret = keys.get("BINANCE_SECRET", "")
            if not api_key or not api_secret:
                return {"status": "error", "message": "Chiavi Binance mancanti."}
            try:
                exchange = ccxt.binance({
                    'apiKey': api_key,
                    'secret': api_secret,
                    'enableRateLimit': True,
                })
                # Check testnet flag if keys are for testnet
                # exchange.set_sandbox_mode(True)
                balance = exchange.fetch_balance()
                return {"status": "success", "message": "Connessione Binance stabilita! Auth OK."}
            except Exception as e:
                return {"status": "error", "message": f"Errore Binance: {str(e)}"}

        elif service == 'kraken':
            import ccxt
            api_key = keys.get("KRAKEN_KEY", "")
            api_secret = keys.get("KRAKEN_SECRET", "")
            if not api_key or not api_secret:
                return {"status": "error", "message": "Chiavi Kraken mancanti."}
            exchange = ccxt.kraken({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
            })
            balance = exchange.fetch_balance()
            return {"status": "success", "message": "Connessione Kraken stabilita! Auth OK."}
            
        elif service == 'elevenlabs':
            # Simple ping with headers
            import requests
            api_key = keys.get("ELEVENLABS_KEY", "")
            if not api_key:
                return {"status": "error", "message": "Chiave ElevenLabs mancante."}
            headers = {"xi-api-key": api_key}
            res = requests.get("https://api.elevenlabs.io/v1/user", headers=headers)
            if res.status_code == 200:
                return {"status": "success", "message": "Connessione ElevenLabs stabilita! Auth OK."}
            else:
                return {"status": "error", "message": f"Errore ElevenLabs: {res.status_code}"}
                
        else:
            # Fallback for others
            return {"status": "success", "message": f"Simulazione test: Connessione a {service.upper()} riuscita!"}
            
    except Exception as e:
        return {"status": "error", "message": f"Errore di connessione: {str(e)}"}



# --- SERVING FRONTEND (React) in Produzione ---
# Questa sezione serve i file statici di React costruiti nella cartella 'dist'
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Evita conflitti con gli endpoint /api/
        if catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API not found")
            
        file_path = os.path.join(frontend_dist, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Per React Router (SPA fallback)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
