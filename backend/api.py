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
import time
from datetime import datetime
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

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0}

def save_db(state_dict):
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
        self.last_trade = None
        self.logs = db_data.get("logs", [])
        self.trade_history = db_data.get("trade_history", [])
        self.high_watermarks = db_data.get("high_watermarks", {})
        self.loop_task = None
        self.aggressiveness = db_data.get("aggressiveness", 55.0)

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

def trading_loop():
    print("Inizio ciclo di trading in background...")
    bot_state.add_log("🟢 Scanner Avviato. Il bot è ora operativo.")
    while bot_state.is_running:
        try:
            if alpaca:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Scansione mercato...")
                # Screener Dinamico: se non abbiamo target, cerchiamo quelli < 30$
                if not bot_state.target_symbols:
                    bot_state.add_log("Avvio Screener Dinamico sul mercato...")
                    valid_symbols = []
                    for sym in POOL_TICKERS:
                        try:
                            trade = alpaca.get_latest_trade(sym)
                            if trade.price < 30.0:
                                valid_symbols.append((sym, trade.price))
                        except:
                            pass
                    # Garantiamo che MRNA sia sempre presente come richiesto
                    scanned = ["MRNA"]
                    for s in valid_symbols:
                        if s[0] != "MRNA" and len(scanned) < 5:
                            scanned.append(s[0])
                
                    if scanned:
                        bot_state.target_symbols = scanned
                        bot_state.latest_predictions = {sym: "In attesa" for sym in scanned}
                        bot_state.add_log(f"Screener: Selezionati {', '.join(scanned)} (<30$)")
                    else:
                        bot_state.add_log("Screener: Nessun ticker valido trovato. Riprovo...")
                        time.sleep(30)
                        continue

                # Recuperiamo dati conto
                positions = alpaca.list_positions()
            
                # Simuliamo l'inferenza del modello per ogni ticker
                for symbol in bot_state.target_symbols:
                    prediction_prob = 50.0
                    if super_model:
                        try:
                            # Scarichiamo gli ultimi 6 mesi usando il ticker tradotto per yfinance
                            yf_sym = get_yf_symbol(symbol)
                            # Usiamo 1h invece di 1d per analisi intraday
                            df = fetch_historical_data(yf_sym, period="1y", interval="1h")
                            X, _, _ = super_model.prepare_features(df)
                        
                            y_pred_prob = super_model.predict(X)
                            prediction_prob = float(y_pred_prob) * 100
                            if math.isnan(prediction_prob):
                                print(f"Attenzione: inferenza ha restituito NaN per {symbol}")
                                prediction_prob = 50.0
                            bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% UP"
                        except Exception as e:
                            print(f"Errore inferenza per {symbol}: {e}")
                            prediction_prob = 50.0
                    else:
                        prediction_prob = random.uniform(20.0, 80.0)
                        bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% (TEST)"
                
                    # Cerchiamo la posizione attuale su questo simbolo
                    position = next((p for p in positions if p.symbol == symbol), None)
                
                    # --- RISK MANAGEMENT: Trailing Stop Loss ---
                    if position:
                        unrealized_plpc = float(position.unrealized_plpc)
                        is_crypto = '/' in symbol
                        tif = 'gtc' if is_crypto else 'day'
                        
                        try:
                            latest_trade = alpaca.get_latest_trade(symbol)
                            current_price = latest_trade.price
                            
                            # Aggiorna High Watermark
                            if symbol not in bot_state.high_watermarks:
                                bot_state.high_watermarks[symbol] = current_price
                                
                            should_sell = False
                            if position.side == 'long':
                                bot_state.high_watermarks[symbol] = max(bot_state.high_watermarks[symbol], current_price)
                                drop_pct = (bot_state.high_watermarks[symbol] - current_price) / bot_state.high_watermarks[symbol]
                                if drop_pct >= 0.025: should_sell = True
                            else:
                                bot_state.high_watermarks[symbol] = min(bot_state.high_watermarks[symbol], current_price)
                                rise_pct = (current_price - bot_state.high_watermarks[symbol]) / bot_state.high_watermarks[symbol]
                                if rise_pct >= 0.025: should_sell = True
                                
                            if should_sell:
                                alpaca.submit_order(symbol=symbol, qty=position.qty, side='sell' if position.side == 'long' else 'buy', type='market', time_in_force=tif)
                                profit_usd = float(position.unrealized_pl)
                                bot_state.add_log(f"TRAILING STOP SCATTATO: {symbol} chiuso al {unrealized_plpc*100:.2f}% (${profit_usd:.2f})")
                                cash_change = float(position.qty) * current_price
                                if position.side == 'long': bot_state.virtual_cash += cash_change
                                else: bot_state.virtual_cash -= cash_change
                                
                                bot_state.close_trade(symbol, position.side, profit_usd, unrealized_plpc)
                                continue  # Salta inferenza
                                
                        except Exception as e:
                            print(f"Errore gestione rischio {symbol}: {e}")
                
                    # Regola LONG / BUY
                    is_crypto = '/' in symbol
                    if prediction_prob >= bot_state.aggressiveness:
                        pos_side = position.side if position else None
                        if pos_side == 'short':
                            # Chiudiamo lo short
                            try:
                                alpaca.submit_order(symbol=symbol, qty=position.qty, side='buy', type='market', time_in_force='day')
                                bot_state.add_log(f"COVER SHORT {position.qty} {symbol} (Prob salita a {prediction_prob:.1f}%)")
                                latest_trade = alpaca.get_latest_trade(symbol)
                                bot_state.virtual_cash -= (float(position.qty) * latest_trade.price)
                                profit_usd = float(position.unrealized_pl)
                                bot_state.close_trade(symbol, 'short', profit_usd, float(position.unrealized_plpc))
                            except Exception as e:
                                print(f"Errore cover short {symbol}: {e}")
                            
                        elif not position or is_crypto:
                            # Calcolo dinamico
                            confidence_scale = (prediction_prob - bot_state.aggressiveness) / (100.0 - bot_state.aggressiveness) if (100.0 - bot_state.aggressiveness) > 0 else 1.0
                            allocation_pct = 0.25 + (0.25 * confidence_scale)
                            max_trade_amount = bot_state.virtual_cash * allocation_pct
                        
                            try:
                                latest_trade = alpaca.get_latest_trade(symbol)
                                current_price = latest_trade.price
                            
                                tif = 'gtc' if is_crypto else 'day'
                            
                                if current_price > 0:
                                    if is_crypto:
                                        # Le crypto costano tanto, usiamo sempre frazioni
                                        trade_amount = round(max_trade_amount, 2)
                                        if trade_amount >= 1.0 and trade_amount <= bot_state.virtual_cash:
                                            alpaca.submit_order(symbol=symbol, notional=trade_amount, side='buy', type='market', time_in_force=tif)
                                            bot_state.add_log(f"BUY CRYPTO {trade_amount}$ {symbol} | Prob: {prediction_prob:.1f}%")
                                            bot_state.virtual_cash -= trade_amount
                                            bot_state.save_state()
                                    else:
                                        # Azioni sotto i 30$, usiamo quantità intere
                                        qty_to_buy = math.floor(max_trade_amount / current_price)
                                        if qty_to_buy > 0 and (qty_to_buy * current_price) <= bot_state.virtual_cash:
                                            alpaca.submit_order(symbol=symbol, qty=qty_to_buy, side='buy', type='market', time_in_force=tif)
                                            bot_state.add_log(f"BUY LONG {qty_to_buy} {symbol} | Prob: {prediction_prob:.1f}%")
                                            bot_state.virtual_cash -= (qty_to_buy * current_price)
                                            bot_state.save_state()
                            except Exception as e:
                                print(f"Errore calcolo ordine long {symbol}: {e}")
                
                    # Regola SHORT / SELL
                    elif prediction_prob <= (100.0 - bot_state.aggressiveness):
                        pos_side = position.side if position else None
                        is_crypto = '/' in symbol
                        tif = 'gtc' if is_crypto else 'day'
                    
                        if pos_side == 'long':
                            # Dobbiamo liquidare il long
                            try:
                                alpaca.submit_order(symbol=symbol, qty=position.qty, side='sell', type='market', time_in_force=tif)
                                bot_state.add_log(f"SELL LONG {position.qty} {symbol} (Prob scesa a {prediction_prob:.1f}%)")
                                latest_trade = alpaca.get_latest_trade(symbol)
                                bot_state.virtual_cash += (float(position.qty) * latest_trade.price)
                                profit_usd = float(position.unrealized_pl)
                                bot_state.close_trade(symbol, 'long', profit_usd, float(position.unrealized_plpc))
                            except Exception as e:
                                print(f"Errore sell long {symbol}: {e}")
                            
                        elif not position and not is_crypto:
                            # Apriamo uno SHORT (SOLO SE NON E' CRYPTO)
                            confidence_scale = ((100.0 - bot_state.aggressiveness) - prediction_prob) / (100.0 - bot_state.aggressiveness) if (100.0 - bot_state.aggressiveness) > 0 else 1.0
                            allocation_pct = 0.25 + (0.25 * confidence_scale)
                            max_trade_amount = bot_state.virtual_cash * allocation_pct
                        
                            try:
                                latest_trade = alpaca.get_latest_trade(symbol)
                                current_price = latest_trade.price
                            
                                if current_price > 0:
                                    qty_to_short = math.floor(max_trade_amount / current_price)
                                
                                    if qty_to_short > 0:
                                        alpaca.submit_order(symbol=symbol, qty=qty_to_short, side='sell', type='market', time_in_force='day')
                                        bot_state.add_log(f"SELL SHORT {qty_to_short} {symbol} | Prob: {prediction_prob:.1f}%")
                                        bot_state.virtual_cash += (qty_to_short * current_price)
                                        bot_state.save_state()
                            except Exception as e:
                                print(f"Errore calcolo ordine short {symbol}: {e}")

        except Exception as e:
            print(f"Errore critico nel loop: {e}")
            
        # Riposo di 60 secondi
        time.sleep(60)
    
    print("Trading Loop terminato.")

@app.get("/api/status")
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
            "win_rate": win_rate
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/start")
def start_bot():
    if not alpaca: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    if not bot_state.is_running:
        bot_state.is_running = True
        bot_state.add_log("Avvio scanner Multi-Asset...")
        threading.Thread(target=trading_loop, daemon=True).start()
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
                is_crypto = '/' in p.symbol
                tif = 'gtc' if is_crypto else 'day'
                alpaca.submit_order(symbol=p.symbol, qty=p.qty, side='sell', type='market', time_in_force=tif)
                liquidati.append(p.symbol)
        
        if liquidati:
            bot_state.add_log(f"KILL SWITCH: Liquidati {', '.join(liquidati)}")
        else:
            bot_state.add_log("Bot fermato (Nessuna posizione aperta)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore Kill Switch: {str(e)}")
        
    return {"message": "Bot fermato", "state": get_status()}

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
