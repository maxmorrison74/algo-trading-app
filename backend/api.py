from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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
from ai_sports_sentiment import AISentimentRadar
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
        self.auto_bet_enabled = db_data.get("auto_bet_enabled", False)
        self.auto_bet_threshold = db_data.get("auto_bet_threshold", 10.0)
        default_modules = {
            "trading": False,
            "crypto_arb": False,
            "sports_arb": False,
            "ai_sports_sentiment": False,
            "ai_content": False
        }
        loaded_modules = db_data.get("modules", {})
        self.modules = {**default_modules, **loaded_modules}
        self.value_bets = []
        
        # Migrazione vecchie chiavi DB
        if "ai_trading" in self.modules:
            self.modules["trading"] = self.modules.pop("ai_trading")

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
            "auto_bet_enabled": self.auto_bet_enabled,
            "auto_bet_threshold": self.auto_bet_threshold,
            "trade_history": self.trade_history,
            "high_watermarks": self.high_watermarks,
            "modules": self.modules
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
# sentiment_engine = AISentimentRadar(bot_state) # Disabilitato temporaneamente
ai_engine = AIContentCreator(bot_state)

engines = {
    "sports_arb": sports_engine,
    "crypto_arb": arb_engine,
    "ai_content": ai_engine
}
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
            "auto_bet_enabled": bot_state.auto_bet_enabled,
            "auto_bet_threshold": bot_state.auto_bet_threshold,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "value_bets": getattr(bot_state, "value_bets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/status")
def api_status(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    try:
        return get_status()
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
        
        # Start/Stop logic
        module_name = mod_id
        if active:
            if module_name == "ai_content" and not ai_engine.running:
                threading.Thread(target=ai_engine.loop, daemon=True).start()
            elif module_name == "sports_arb" and not sports_engine.running:
                t = threading.Thread(target=sports_engine.loop, daemon=True)
                t.start()
                bot_state.add_log("⚽ Modulo Sports Arbitrage avviato.")
            elif module_name == "ai_sports_sentiment" and not getattr(sentiment_engine, "running", False):
                t = threading.Thread(target=sentiment_engine.loop, daemon=True)
                t.start()
                bot_state.add_log("📡 Modulo AI Sentiment Radar avviato.")
            elif module_name == "crypto_arb" and not arb_engine.running:
                threading.Thread(target=arb_engine.loop, daemon=True).start()
            elif module_name == "trading" and not alpaca_engine.running:
                bot_state.is_running = True
                threading.Thread(target=alpaca_engine.loop, daemon=True).start()
        else:
            if module_name == "sports_arb":
                sports_engine.stop()
                bot_state.add_log("⚽ Modulo Sports Arbitrage fermato.")
            elif module_name == "ai_sports_sentiment":
                sentiment_engine.stop()
                bot_state.add_log("📡 Modulo AI Sentiment Radar fermato.")
            elif module_name == "trading":
                bot_state.is_running = False
                
        return {"message": "Modulo aggiornato", "modules": bot_state.modules,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "value_bets": getattr(bot_state, "value_bets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])}
    return {"error": "Modulo non trovato"}


@app.post("/api/auto-bet-settings")
async def update_auto_bet_settings(payload: dict):
    """Aggiorna le impostazioni dell'auto-bet (abilitato + soglia %)"""
    try:
        changed = False
        if "enabled" in payload:
            bot_state.auto_bet_enabled = bool(payload["enabled"])
            changed = True
            state = "ABILITATO" if bot_state.auto_bet_enabled else "DISABILITATO"
            thresh = float(getattr(bot_state, "auto_bet_threshold", 10.0))
            bot_state.add_log(f"🤖 Auto-Bet {state} (soglia: {thresh:.1f}%)")
        
        if "threshold" in payload:
            val = float(payload["threshold"])
            bot_state.auto_bet_threshold = max(1.0, min(val, 50.0))  # clamp 1-50%
            changed = True
            thresh = float(bot_state.auto_bet_threshold)
            bot_state.add_log(f"🤖 Auto-Bet soglia aggiornata a {thresh:.1f}%")
            
        if changed:
            bot_state.save_state()
            
        return {
            "status": "ok",
            "auto_bet_enabled": getattr(bot_state, "auto_bet_enabled", False),
            "auto_bet_threshold": getattr(bot_state, "auto_bet_threshold", 10.0)
        }
    except Exception as e:
        print(f"Errore update_auto_bet_settings: {e}")
        return {"error": str(e)}


@app.post("/api/place-bet")
async def place_bet(payload: dict):
    """
    Registra una scommessa virtuale su una surebet identificata dal radar.
    Deduce lo stake dal portafoglio virtuale e traccia la bet in attesa del risultato.
    """
    try:
        match   = payload.get("match", "N/A")
        p1      = payload.get("p1", "?")
        p2      = payload.get("p2", "?")
        book1   = payload.get("book1", "?")
        book2   = payload.get("book2", "?")
        odds1   = float(payload.get("odds1", 0))
        odds2   = float(payload.get("odds2", 0))
        stake1  = float(payload.get("stake1", 0))
        stake2  = float(payload.get("stake2", 0))
        total   = float(payload.get("total_stake", 100.0))
        profit_margin    = float(payload.get("profit_margin", 0))
        guaranteed_return = float(payload.get("guaranteed_return", 0))

        if bot_state.virtual_cash < total:
            return {"status": "error", "message": f"Saldo insufficiente (disponibile: ${bot_state.virtual_cash:.2f})"}

        # Deduce lo stake dal portafoglio virtuale
        bot_state.virtual_cash -= total

        # Registra la scommessa nella cronologia
        bet_record = {
            "type": "SUREBET",
            "match": match,
            "p1": p1, "p2": p2,
            "book1": book1, "book2": book2,
            "odds1": odds1, "odds2": odds2,
            "stake1": stake1, "stake2": stake2,
            "total_stake": total,
            "profit_margin": profit_margin,
            "guaranteed_return": guaranteed_return,
            "expected_profit": round(guaranteed_return - total, 2),
            "status": "pending",
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        bot_state.trade_history.insert(0, bet_record)
        bot_state.save_state()

        bot_state.add_log(
            f"⚽ SUREBET PIAZZATA: {match} | "
            f"{book1} @{odds1:.2f} (€{stake1:.2f}) + {book2} @{odds2:.2f} (€{stake2:.2f}) | "
            f"Profitto atteso: +€{guaranteed_return - total:.2f} ({profit_margin:.2f}%)"
        )

        return {
            "status": "ok",
            "message": "Scommessa registrata con successo",
            "cash_remaining": round(bot_state.virtual_cash, 2),
            "expected_profit": round(guaranteed_return - total, 2)
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


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
    gemini_key: str = ""
    newsapi_key: str = ""
    google_cloud_json: str = ""


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
        if os.path.exists(".env.gcp.json"):
            keys["GOOGLE_APPLICATION_CREDENTIALS"] = "MASKED_JSON"
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
        new_gemini_key = merge("GEMINI_KEY", req.gemini_key)
        new_newsapi_key = merge("NEWSAPI_KEY", req.newsapi_key)

        with open(API_KEYS_FILE, "w") as f:
            f.write(f"ALPACA_KEY={new_alpaca_key}\n")
            f.write(f"ALPACA_SECRET={new_alpaca_secret}\n")
            f.write(f"BINANCE_KEY={new_binance_key}\n")
            f.write(f"BINANCE_SECRET={new_binance_secret}\n")
            f.write(f"KRAKEN_KEY={new_kraken_key}\n")
            f.write(f"KRAKEN_SECRET={new_kraken_secret}\n")
            f.write(f"ELEVENLABS_KEY={new_elevenlabs_key}\n")
            f.write(f"THEODDS_KEY={new_theodds_key}\n")
            f.write(f"GEMINI_KEY={new_gemini_key}\n")
            f.write(f"NEWSAPI_KEY={new_newsapi_key}\n")
            
        if req.google_cloud_json and "***" not in req.google_cloud_json:
            with open(".env.gcp.json", "w") as f:
                f.write(req.google_cloud_json)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".env.gcp.json"
            
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
    newsapi_key: str = ""


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
    if req.newsapi_key and "***" not in req.newsapi_key: keys['NEWSAPI_KEY'] = req.newsapi_key
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

            api_key = keys.get("ELEVENLABS_KEY", "")
            if not api_key:
                return {"status": "error", "message": "Chiave ElevenLabs mancante."}
            headers = {"xi-api-key": api_key}
            res = requests.get("https://api.elevenlabs.io/v1/user", headers=headers)
            if res.status_code == 200:
                return {"status": "success", "message": "Connessione ElevenLabs stabilita! Auth OK."}
            else:
                return {"status": "error", "message": f"Errore ElevenLabs: {res.status_code}"}
                
        elif service == 'newsapi':
            api_key = keys.get("NEWSAPI_KEY", "")
            if not api_key:
                return {"status": "error", "message": "Chiave NewsAPI mancante."}
            res = requests.get(f"https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey={api_key}")
            if res.status_code == 200:
                return {"status": "success", "message": "Connessione NewsAPI stabilita! Auth OK."}
            else:
                return {"status": "error", "message": f"Errore NewsAPI: {res.status_code} - {res.text}"}
                
        else:
            # Fallback for others
            return {"status": "success", "message": f"Simulazione test: Connessione a {service.upper()} riuscita!"}
            
    except Exception as e:
        return {"status": "error", "message": f"Errore di connessione: {str(e)}"}



class GenerateIdeaRequest(BaseModel):
    gemini_key: str

@app.post("/api/ai/generate-idea")
def generate_idea(req: GenerateIdeaRequest):
    if not req.gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required")
    try:
        import google.generativeai as genai
        genai.configure(api_key=req.gemini_key)
        model = genai.GenerativeModel("gemini-1.5-pro")
        
        topics = [
            "Bitcoin verso nuovi massimi, cosa dicono gli analisti istituzionali",
            "Il nuovo aggiornamento DeFi e come trarne profitto",
            "Intelligenza Artificiale: l'impatto sul trading algoritmico",
            "Mercati globali in tensione, beni rifugio in salita"
        ]
        topic = random.choice(topics)
        
        prompt = f"Sei un esperto creatore di contenuti per YouTube Shorts. Scrivi uno script di 45 secondi su: '{topic}'. Dopo lo script, fornisci un prompt esatto e iper-dettagliato in inglese per generare un video realistico e cinematico con Google Veo che faccia da sfondo allo script. Formato: SCRIPT: ... PROMPT_VEO: ..."
        
        response = model.generate_content(prompt)
        text = response.text
        
        script_part = text.split("PROMPT_VEO:")[0].replace("SCRIPT:", "").strip()
        veo_prompt = text.split("PROMPT_VEO:")[1].strip() if "PROMPT_VEO:" in text else "Cinematic 4k shot of trading charts."
        
        return {"topic": topic, "script": script_part, "prompt": veo_prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/upload-video")
async def upload_video(topic: str = Form(...), prompt: str = Form(...), file: UploadFile = File(...)):
    import uuid
    import shutil
    
    os.makedirs("uploads", exist_ok=True)
    filename = f"{uuid.uuid4()}.mp4"
    filepath = os.path.join("uploads", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    ai_engine.add_video_to_queue(topic, prompt, filepath)
    return {"status": "success", "message": "Video aggiunto alla coda di distribuzione"}

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
            headers = {}
            if file_path.endswith(".html"):
                headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                headers["Pragma"] = "no-cache"
                headers["Expires"] = "0"
            return FileResponse(file_path, headers=headers)
            
        # Per React Router (SPA fallback)
        headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        return FileResponse(os.path.join(frontend_dist, "index.html"), headers=headers)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
