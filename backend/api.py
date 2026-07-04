from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response, UploadFile, File, Form, Depends, status
from risk_manager import get_risk_manager, RiskLimits
from capital_manager import get_capital_manager
from dataclasses import asdict
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
import db
from typing import Optional
import requests
import threading
import atexit
from concurrent.futures import ThreadPoolExecutor

# Thread Pool Globale per limitare le risorse
global_executor = ThreadPoolExecutor(max_workers=10)
atexit.register(lambda: global_executor.shutdown(wait=False))

from crypto_arbitrage import CryptoArbitrage
from sports_arbitrage import SportsArbitrage
from ai_sports_sentiment import AISentimentRadar
from ai_content import AIContentCreator
from alpaca_trading import AlpacaEngine
import concurrent.futures
import gc
import time
from datetime import datetime
from uuid import uuid4
import yfinance as yf
import pandas as pd
import sys
import routers_ai_invest
from auth import (
    assert_login_allowed,
    begin_passkey_authentication,
    begin_passkey_registration,
    clear_login_failures,
    create_admin_session,
    finish_passkey_authentication,
    finish_passkey_registration,
    get_passkey_status,
    is_admin_configured,
    record_login_failure,
    require_admin,
    require_user,
    create_user_token,
    revoke_admin_session,
    verify_admin_password,
)
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
db_lock = threading.Lock()
SYMBOL_RANK_CACHE_TTL_SECONDS = 300
symbol_rank_cache = {"expires_at": 0.0, "max_symbols": 0, "result": ([], [])}

def load_db():
    with db_lock:
        if os.path.exists(DB_FILE):
            try:
                with open(DB_FILE, "r") as f:
                    data = json.load(f)
                    if "modules" in data and "high_risk_crypto_arb" not in data["modules"]:
                        data["modules"]["high_risk_crypto_arb"] = False
                    return data
            except json.JSONDecodeError:
                print("⚠️ bot_db.json corrotto (forse per un riavvio forzato). Ricarico default.")
        return {"virtual_cash": 100.0, "logs": [], "aggressiveness": 55.0, "modules": {"trading": False, "crypto_arb": False, "high_risk_crypto_arb": False, "sports_arb": False, "ai_content": False}}

def save_db(state_dict):
    with db_lock:
        with open(DB_FILE, "w") as f:
            json.dump(state_dict, f)

def _parse_allowed_origins():
    raw = os.getenv("ALLOWED_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://tuodominio.com",
    ]


app = FastAPI(title="AlgoTrading Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/risk/status")
def risk_status():
    """Stato del risk manager"""
    risk = get_risk_manager(initial_capital=bot_state.virtual_cash)
    return risk.get_status()

@app.post("/api/risk/limits")
def update_risk_limits(limits: dict, _: str = Depends(require_admin)):
    """Aggiorna i limiti di risk (solo admin)"""
    risk = get_risk_manager()
    risk.limits = RiskLimits(**limits)
    return {"status": "ok", "limits": asdict(risk.limits)}

@app.post("/api/risk/emergency-stop")
def emergency_stop(_: str = Depends(require_admin)):
    """Kill switch manuale"""
    risk = get_risk_manager()
    risk._trigger_circuit_breaker("STOP MANUALE dall'utente")
    
    # Chiudi tutte le posizioni Alpaca (se presente)
    try:
        if alpaca:
            positions = alpaca.list_positions()
            for p in positions:
                alpaca.submit_order(
                    symbol=p.symbol,
                    qty=p.qty,
                    side='sell' if p.side == 'long' else 'buy',
                    type='market',
                    time_in_force='day'
                )
    except Exception as e:
        return {"status": "error", "message": str(e)}
        
    return {"status": "ok", "message": "🛑 EMERGENCY STOP eseguito"}

@app.get("/api/capital/status")
def capital_status():
    """Stato gestione capitale"""
    cap = get_capital_manager()
    return cap.get_status()

@app.post("/api/capital/advance")
def advance_phase(_: str = Depends(require_admin)):
    """Prova ad avanzare alla fase successiva"""
    cap = get_capital_manager()
    success, msg = cap.advance_phase()
    return {"success": success, "message": msg}

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

app.include_router(routers_ai_invest.router)

keys_path = os.path.join(os.path.dirname(__file__), ".env.keys")
if os.path.exists(keys_path):
    load_dotenv(dotenv_path=keys_path)

API_KEY = os.getenv("ALPACA_KEY", os.getenv("ALPACA_API_KEY"))
API_SECRET = os.getenv("ALPACA_SECRET", os.getenv("ALPACA_SECRET_KEY"))
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

DEFAULT_TARGET_SYMBOLS = ["TSLA", "NVDA", "PLTR", "SOFI", "MARA", "AMD", "AAPL"]
STOCK_UNIVERSE = [ticker for ticker in POOL_TICKERS if "/" not in ticker] + [
    "AAPL", "AMD", "AMZN", "AVGO", "META", "MSFT", "MARA", "MU", "NFLX",
    "NVDA", "QQQ", "SMCI", "SPY", "TSLA", "UBER"
]
STOCK_UNIVERSE = list(dict.fromkeys(STOCK_UNIVERSE))
MEME_OR_HIGH_NOISE_TICKERS = {"AMC", "GME", "WBD", "PARA", "SNAP", "LCID"}
SYMBOL_GROUPS = {
    "mega_cap_tech": {"AAPL", "MSFT", "NVDA", "META", "AMZN", "AVGO"},
    "semis": {"NVDA", "AMD", "AVGO", "MU", "SMCI"},
    "consumer_ev": {"TSLA", "RIVN", "LCID", "NIO"},
    "fintech": {"SOFI", "HOOD", "BAC"},
    "travel_leisure": {"CCL", "AAL", "DKNG", "LYFT", "UBER"},
}


def _safe_metric(series, default=0.0):
    try:
        value = float(series)
        if math.isnan(value) or math.isinf(value):
            return default
        return value
    except Exception:
        return default


def _normalize_metric(value, minimum, maximum):
    if maximum <= minimum:
        return 0.5
    return max(0.0, min(1.0, (value - minimum) / (maximum - minimum)))


def rank_stock_universe(max_symbols: int = 7):
    now_ts = time.time()
    if (
        symbol_rank_cache["result"][0]
        and symbol_rank_cache["max_symbols"] == max_symbols
        and symbol_rank_cache["expires_at"] > now_ts
    ):
        return symbol_rank_cache["result"]

    tickers = STOCK_UNIVERSE[:]
    if not tickers:
        return [], []

    try:
        data = yf.download(
            tickers=tickers,
            period="1mo",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        print(f"Errore download ranking tickers: {e}")
        fallback_result = (DEFAULT_TARGET_SYMBOLS[:max_symbols], [])
        symbol_rank_cache.update({
            "expires_at": now_ts + 60,
            "max_symbols": max_symbols,
            "result": fallback_result,
        })
        return fallback_result

    ranked_rows = []
    for ticker in tickers:
        try:
            df = data[ticker] if len(tickers) > 1 else data
            if df is None or df.empty or len(df) < 15:
                continue
            if ticker in MEME_OR_HIGH_NOISE_TICKERS:
                continue

            close = df["Close"].dropna()
            volume = df["Volume"].dropna()
            high = df["High"].dropna() if "High" in df else close
            low = df["Low"].dropna() if "Low" in df else close
            open_price = df["Open"].dropna() if "Open" in df else close
            if close.empty or volume.empty or len(close) < 15:
                continue

            last_price = _safe_metric(close.iloc[-1])
            if last_price < 5.0:
                continue

            daily_returns = close.pct_change().dropna()
            if daily_returns.empty:
                continue

            momentum_5d = _safe_metric((close.iloc[-1] / close.iloc[-6]) - 1, 0.0) if len(close) >= 6 else 0.0
            momentum_20d = _safe_metric((close.iloc[-1] / close.iloc[0]) - 1, 0.0)
            volatility_20d = _safe_metric(daily_returns.tail(20).std(), 0.0)
            avg_dollar_volume = _safe_metric((close.tail(20) * volume.tail(20)).mean(), 0.0)
            ma20 = _safe_metric(close.tail(20).mean(), last_price)
            trend_strength = _safe_metric((last_price / ma20) - 1, 0.0) if ma20 > 0 else 0.0
            rolling_high_20d = _safe_metric(high.tail(20).max(), last_price)
            distance_to_breakout = _safe_metric(last_price / rolling_high_20d, 1.0) if rolling_high_20d > 0 else 1.0
            positive_days_ratio = _safe_metric((daily_returns.tail(20) > 0).mean(), 0.5)
            prev_close = close.shift(1)
            gap_series = ((open_price - prev_close).abs() / prev_close).dropna()
            avg_gap_20d = _safe_metric(gap_series.tail(20).mean(), 0.0)
            true_range = pd.concat([
                (high - low),
                (high - prev_close).abs(),
                (low - prev_close).abs()
            ], axis=1).max(axis=1).dropna()
            atr_14 = _safe_metric(true_range.tail(14).mean(), 0.0)
            atr_percent = _safe_metric(atr_14 / last_price, 0.0) if last_price > 0 else 0.0

            if momentum_20d <= -0.12:
                continue
            if avg_dollar_volume < 15_000_000:
                continue
            if avg_gap_20d > 0.04:
                continue
            if positive_days_ratio < 0.45:
                continue

            ranked_rows.append({
                "symbol": ticker,
                "price": round(last_price, 2),
                "momentum_5d": momentum_5d,
                "momentum_20d": momentum_20d,
                "volatility_20d": volatility_20d,
                "avg_dollar_volume": avg_dollar_volume,
                "trend_strength": trend_strength,
                "distance_to_breakout": distance_to_breakout,
                "positive_days_ratio": positive_days_ratio,
                "avg_gap_20d": avg_gap_20d,
                "atr_percent": atr_percent,
            })
        except Exception:
            continue

    if not ranked_rows:
        fallback_result = (DEFAULT_TARGET_SYMBOLS[:max_symbols], [])
        symbol_rank_cache.update({
            "expires_at": now_ts + 60,
            "max_symbols": max_symbols,
            "result": fallback_result,
        })
        return fallback_result

    metric_ranges = {}
    for key in [
        "momentum_5d",
        "momentum_20d",
        "volatility_20d",
        "avg_dollar_volume",
        "trend_strength",
        "distance_to_breakout",
        "positive_days_ratio",
        "avg_gap_20d",
        "atr_percent",
    ]:
        values = [row[key] for row in ranked_rows]
        metric_ranges[key] = (min(values), max(values))

    for row in ranked_rows:
        breakout_score = _normalize_metric(row["distance_to_breakout"], *metric_ranges["distance_to_breakout"])
        consistency_score = _normalize_metric(row["positive_days_ratio"], *metric_ranges["positive_days_ratio"])
        gap_penalty = 1 - _normalize_metric(row["avg_gap_20d"], *metric_ranges["avg_gap_20d"])
        atr_quality = _normalize_metric(row["atr_percent"], *metric_ranges["atr_percent"])
        row["score"] = round(
            0.24 * _normalize_metric(row["momentum_5d"], *metric_ranges["momentum_5d"]) +
            0.18 * _normalize_metric(row["momentum_20d"], *metric_ranges["momentum_20d"]) +
            0.16 * _normalize_metric(row["avg_dollar_volume"], *metric_ranges["avg_dollar_volume"]) +
            0.10 * _normalize_metric(row["volatility_20d"], *metric_ranges["volatility_20d"]) +
            0.10 * _normalize_metric(row["trend_strength"], *metric_ranges["trend_strength"]) +
            0.10 * breakout_score +
            0.06 * consistency_score +
            0.03 * atr_quality +
            0.03 * gap_penalty,
            4
        )
        row["selection_reason"] = (
            f"mom5={row['momentum_5d']*100:.1f}% | "
            f"mom20={row['momentum_20d']*100:.1f}% | "
            f"breakout={row['distance_to_breakout']*100:.1f}% 20d high | "
            f"gap={row['avg_gap_20d']*100:.1f}%"
        )

    ranked_rows.sort(key=lambda row: row["score"], reverse=True)

    selected_rows = []
    used_groups = set()
    for row in ranked_rows:
        ticker = row["symbol"]
        ticker_groups = {group for group, members in SYMBOL_GROUPS.items() if ticker in members}
        is_diversified_pick = not ticker_groups or len(used_groups.intersection(ticker_groups)) < len(ticker_groups)

        # Prima passata: privilegia diversificazione tra gruppi simili
        if is_diversified_pick:
            selected_rows.append(row)
            used_groups.update(ticker_groups)
        if len(selected_rows) >= max_symbols:
            break

    if len(selected_rows) < max_symbols:
        selected_symbols_set = {row["symbol"] for row in selected_rows}
        for row in ranked_rows:
            if row["symbol"] in selected_symbols_set:
                continue
            selected_rows.append(row)
            if len(selected_rows) >= max_symbols:
                break

    selected_symbols = [row["symbol"] for row in selected_rows]
    result = (selected_symbols, selected_rows[:max_symbols])
    symbol_rank_cache.update({
        "expires_at": now_ts + SYMBOL_RANK_CACHE_TTL_SECONDS,
        "max_symbols": max_symbols,
        "result": result,
    })
    return result


def refresh_target_symbols(max_symbols: int = 7):
    selected_symbols, ranked_rows = rank_stock_universe(max_symbols=max_symbols)
    bot_state.target_symbols = selected_symbols or DEFAULT_TARGET_SYMBOLS[:max_symbols]
    bot_state.symbol_selection = {
        "updated_at": datetime.now().isoformat(),
        "method": "momentum_liquidity_volatility",
        "ranked": ranked_rows,
    }
    bot_state.save_state()
    return bot_state.target_symbols

def get_yf_symbol(symbol):
    """Converte simboli Alpaca in simboli Yahoo Finance."""
    return symbol.replace("/", "-")

target_symbols = [] # Inizialmente vuoto, verrà popolato dinamicamente

class BotState:
    def __init__(self):
        db_data = load_db()
        self.is_running = False
        self.target_symbols = db_data.get("target_symbols", DEFAULT_TARGET_SYMBOLS[:])
        self.virtual_cash = db_data.get("virtual_cash", 100.0)
        self.portfolio_value = 0.0
        self.latest_predictions = {}
        self.ai_sentiment = {}
        self.last_trade = None
        self.logs = db_data.get("logs", [])
        self.trade_history = db_data.get("trade_history", [])
        self.ai_investments = db_data.get("ai_investments", [])
        self.high_watermarks = db_data.get("high_watermarks", {})
        self.high_risk_arb_logs = []
        self.high_risk_arb_prices = {}
        self.high_risk_volatile_assets = []
        self.monitored_positions = []  # [{symbol, buy_price, qty, amount, peak_price, target_price, price_history, timestamp}]
        self.reentry_watchlist = []   # [{symbol, exit_price, original_amount, reentry_count, trigger_pct, added_at}]
        self.loop_task = None
        self.aggressiveness = db_data.get("aggressiveness", 55.0)
        self.auto_bet_enabled = db_data.get("auto_bet_enabled", False)
        self.auto_bet_threshold = db_data.get("auto_bet_threshold", 10.0)
        self.symbol_selection = db_data.get("symbol_selection", {"method": "static_default", "ranked": []})
        default_modules = {
            "trading": False,
            "crypto_arb": False,
            "high_risk_crypto_arb": False,
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
            "ai_investments": self.ai_investments,
            "high_watermarks": self.high_watermarks,
            "modules": self.modules,
            "target_symbols": self.target_symbols,
            "symbol_selection": self.symbol_selection,
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
if not bot_state.target_symbols:
    bot_state.target_symbols = DEFAULT_TARGET_SYMBOLS[:]
# Inizializza moduli background
arb_engine = CryptoArbitrage(bot_state)
sports_engine = SportsArbitrage(bot_state)
sentiment_engine = None
ai_engine = AIContentCreator(bot_state)

engines = {
    "sports_arb": sports_engine,
    "crypto_arb": arb_engine,
    "ai_content": ai_engine
}
alpaca_engine = AlpacaEngine(bot_state)
trade_lock = threading.Lock()


def _normalize_ccxt_symbol(symbol: str) -> str:
    symbol = symbol.upper().strip()

    if "/" in symbol:
        return symbol

    if symbol.endswith("USDT"):
        return symbol[:-4] + "/USDT"

    return symbol + "/USDT"


def _fetch_ccxt_price(symbol: str) -> float:
    try:
        import ccxt
        exchange = ccxt.binance({"enableRateLimit": True})

        sym_fmt = _normalize_ccxt_symbol(symbol)
        markets = exchange.load_markets()

        if sym_fmt not in markets:
            print(f"[AUTO-EXIT] Simbolo non trovato su Binance: {symbol} -> {sym_fmt}")
            return 0.0

        ticker = exchange.fetch_ticker(sym_fmt)
        return float(ticker.get("last") or ticker.get("close") or 0.0)

    except Exception as e:
        print(f"[AUTO-EXIT] Errore fetch prezzo {symbol}: {e}")
        return 0.0


def _send_telegram_trade(event: str, symbol: str, qty: float, price: float,
                          profit_usd: float = 0.0, profit_pct: float = 0.0,
                          reason: str = "", virtual_cash: float = 0.0):
    """Invia una notifica Telegram ricca per eventi di trading HIGH RISK."""
    sign = "+" if profit_usd >= 0 else ""
    emoji_map = {
        "BUY":     "⚡",
        "SELL":    "💰",
        "AUTO-EXIT": "🤖",
        "TARGET":  "🎯",
        "STOP":    "🛡️",
        "REENTRY": "🔄",
    }
    emoji = emoji_map.get(event, "📢")
    msg = (
        f"{emoji} *AUREO HIGH RISK — {event}*\n"
        f"Token: `{symbol}`\n"
        f"Prezzo: `${price:.8f}`\n"
        f"Quantità: `{qty:.4f}`\n"
    )
    if profit_usd != 0.0 or profit_pct != 0.0:
        msg += f"P&L: `{sign}{profit_usd:.2f}$ ({sign}{profit_pct:.2f}%)`\n"
    if reason:
        msg += f"Motivo: {reason}\n"
    if virtual_cash > 0:
        msg += f"Saldo virtuale: `${virtual_cash:.2f}`"
    send_telegram_message(msg)


def _auto_exit_loop():
    """Loop background: monitora le posizioni aperte e vende con trailing stop / target price."""
    # Gestione dinamica del Trailing Stop: 
    # Meno profitto = stop più largo (-1.5%). Più profitto = stop stretto (-0.8%)
    BASE_TRAILING_DROP  = 0.015   
    TIGHT_TRAILING_DROP = 0.008
    STOP_LOSS      = 0.05    # sell if drops 5% from buy
    CHECK_INTERVAL = 3       # seconds between checks (ULTRA FAST)
    MAX_HISTORY    = 50      # max price history points per position

    print("[AUTO-EXIT] Loop di sorveglianza avviato.")
    while True:
        try:
            positions = list(bot_state.monitored_positions)  # snapshot
            for pos in positions:
                symbol     = pos["symbol"]
                buy_price  = pos["buy_price"]
                qty        = pos["qty"]
                amount     = pos["amount"]
                peak_price = pos.get("peak_price", buy_price)
                target_price = pos.get("target_price", None)

                current_price = _fetch_ccxt_price(symbol)
                if current_price <= 0:
                    continue

                # Aggiorna il picco
                if current_price > peak_price:
                    pos["peak_price"] = current_price
                    peak_price = current_price

                profit_pct     = (current_price - buy_price) / buy_price
                drop_from_peak = (peak_price - current_price) / peak_price if peak_price > 0 else 0

                # Aggiorna price_history (max MAX_HISTORY punti)
                if "price_history" not in pos:
                    pos["price_history"] = []
                pos["price_history"].append({
                    "t": datetime.now().strftime("%H:%M"),
                    "p": round(current_price, 8),
                    "pnl": round(profit_pct * 100, 3)
                })
                if len(pos["price_history"]) > MAX_HISTORY:
                    pos["price_history"] = pos["price_history"][-MAX_HISTORY:]

                should_sell  = False
                sell_reason  = ""
                is_trailing  = False

                # Gestione trailing dinamico
                current_trailing = TIGHT_TRAILING_DROP if profit_pct > 0.05 else BASE_TRAILING_DROP

                # 1) Target price raggiunto
                if target_price and current_price >= target_price:
                    should_sell = True
                    sell_reason = f"🎯 TARGET RAGGIUNTO: ${target_price:.8f}"

                # 2) Trailing stop dinamico
                elif profit_pct > 0 and drop_from_peak >= current_trailing:
                    should_sell = True
                    is_trailing = True
                    sell_reason = f"🔔 TRAILING STOP DINAMICO (-{current_trailing*100:.1f}%): -{drop_from_peak*100:.1f}% dal picco (+{profit_pct*100:.1f}%)"

                # 3) Hard stop loss
                elif profit_pct <= -STOP_LOSS:
                    should_sell = True
                    sell_reason = f"🛡️ STOP LOSS: -{abs(profit_pct)*100:.1f}% dal prezzo d'acquisto"

                if should_sell:
                    realized_value  = qty * current_price
                    realized_profit = realized_value - amount
                    bot_state.virtual_cash += realized_value
                    pct_str = f"+{realized_profit:.2f}" if realized_profit >= 0 else f"{realized_profit:.2f}"
                    log_msg = (
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"🤖 AUTO-EXIT {symbol} {qty:.4f} @ ${current_price:.8f} "
                        f"({pct_str}$) — {sell_reason}"
                    )
                    bot_state.high_risk_arb_logs.insert(0, log_msg)
                    bot_state.add_log(log_msg)

                    # Notifica Telegram ricca
                    event_type = "TARGET" if "TARGET" in sell_reason else ("STOP" if "STOP LOSS" in sell_reason else "AUTO-EXIT")
                    _send_telegram_trade(
                        event=event_type,
                        symbol=symbol, qty=qty, price=current_price,
                        profit_usd=realized_profit, profit_pct=profit_pct * 100,
                        reason=sell_reason, virtual_cash=bot_state.virtual_cash
                    )

                    # Trade history
                    
                    risk = get_risk_manager(initial_capital=bot_state.virtual_cash)
                    cap = get_capital_manager()
                    risk.record_trade(symbol, "AUTO-EXIT", qty=amount, price=current_price, pnl=realized_profit)
                    cap.record_trade_result(realized_profit)
                    
                    bot_state.trade_history.append({
                        "symbol": symbol, "side": "AUTO-EXIT",
                        "profit_usd": round(realized_profit, 4),
                        "profit_pct": round(profit_pct * 100, 2),
                        "date": datetime.now().strftime("%Y-%m-%d %H:%M")
                    })

                    # Re-entry watchlist solo dopo trailing stop (non stop loss)
                    if is_trailing:
                        already = any(w["symbol"] == symbol for w in bot_state.reentry_watchlist)
                        existing_count = sum(1 for t in bot_state.trade_history
                                            if t.get("symbol") == symbol and t.get("side") == "REENTRY")
                        if not already and existing_count < 3:
                            bot_state.reentry_watchlist.append({
                                "symbol": symbol,
                                "exit_price": current_price,
                                "original_amount": amount,
                                "trigger_price": round(current_price * 1.02, 8),  # +2%
                                "trigger_pct": 2.0,
                                "reentry_count": existing_count,
                                "added_at": datetime.now().strftime("%H:%M:%S")
                            })
                            bot_state.high_risk_arb_logs.insert(0,
                                f"[{datetime.now().strftime('%H:%M:%S')}] 🔄 RE-ENTRY watchlist: {symbol} — attendo +2% da ${current_price:.8f}")

                    # Rimuovi dalla lista monitorata
                    try:
                        bot_state.monitored_positions.remove(pos)
                    except ValueError:
                        pass
                    bot_state.save_state()

                else:
                    log_snap = (
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"👁️ {symbol} @ ${current_price:.8f} "
                        f"P&L: {profit_pct*100:+.2f}% | picco: ${peak_price:.8f}"
                        + (f" | 🎯 target: ${target_price:.8f}" if target_price else "")
                    )
                    bot_state.high_risk_arb_logs.insert(0, log_snap)
                    if len(bot_state.high_risk_arb_logs) > 100:
                        bot_state.high_risk_arb_logs = bot_state.high_risk_arb_logs[:100]
        except Exception as e:
            print(f"[AUTO-EXIT] Errore nel loop: {e}")
        time.sleep(CHECK_INTERVAL)


def _reentry_loop():
    """Loop asincrono che monitora i prezzi per triggerare i re-entry automatici."""
    CHECK_INTERVAL = 3  # secondi (FAST)
    MAX_REENTRY    = 3

    print("[RE-ENTRY] Loop watchlist avviato.")
    while True:
        try:
            watchlist = list(bot_state.reentry_watchlist)
            for entry in watchlist:
                symbol          = entry["symbol"]
                exit_price      = entry["exit_price"]
                trigger_price   = entry["trigger_price"]
                original_amount = entry["original_amount"]
                reentry_count   = entry.get("reentry_count", 0)

                if reentry_count >= MAX_REENTRY:
                    try:
                        bot_state.reentry_watchlist.remove(entry)
                    except ValueError:
                        pass
                    continue

                current_price = _fetch_ccxt_price(symbol)
                if current_price <= 0:
                    continue

                if current_price >= trigger_price:
                    # Verifica liquidità virtuale
                    if bot_state.virtual_cash < original_amount:
                        continue

                    qty = original_amount / current_price
                    bot_state.virtual_cash -= original_amount

                    # Aggiungi alla sorveglianza
                    bot_state.monitored_positions.append({
                        "symbol":      symbol,
                        "buy_price":   current_price,
                        "qty":         qty,
                        "amount":      original_amount,
                        "peak_price":  current_price,
                        "target_price": None,
                        "price_history": [],
                        "timestamp":   datetime.now().strftime("%H:%M:%S")
                    })

                    log_msg = (
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"🔄 RE-ENTRY #{reentry_count+1} {symbol} {qty:.4f} @ ${current_price:.8f} "
                        f"(exit era ${exit_price:.8f}, +{((current_price/exit_price)-1)*100:.1f}%)"
                    )
                    bot_state.high_risk_arb_logs.insert(0, log_msg)
                    bot_state.add_log(log_msg)

                    # Telegram
                    _send_telegram_trade(
                        event="REENTRY", symbol=symbol, qty=qty, price=current_price,
                        reason=f"Re-entry #{reentry_count+1} — +{((current_price/exit_price)-1)*100:.1f}% dall'uscita",
                        virtual_cash=bot_state.virtual_cash
                    )

                    # Trade history
                    bot_state.trade_history.append({
                        "symbol": symbol, "side": "REENTRY",
                        "profit_usd": 0.0, "profit_pct": 0.0,
                        "date": datetime.now().strftime("%Y-%m-%d %H:%M")
                    })

                    # Rimuovi dalla watchlist
                    try:
                        bot_state.reentry_watchlist.remove(entry)
                    except ValueError:
                        pass
                    bot_state.save_state()

        except Exception as e:
            print(f"[RE-ENTRY] Errore nel loop: {e}")
        time.sleep(CHECK_INTERVAL)


# Avvia i loop in background
# thread sostituito da executor
global_executor.submit(_auto_exit_loop)
# thread sostituito da executor
global_executor.submit(_reentry_loop)
def get_status():
    if not alpaca: return {"error": "Alpaca API non configurata."}
    pos_dict = {}
    virtual_portfolio_value = bot_state.virtual_cash
    try:
        if alpaca:
            try:
                account = alpaca.get_account()
                positions = alpaca.list_positions()
                
                # Creiamo un dizionario delle posizioni aperte formattato per il frontend
                for p in positions:
                    if p.symbol in bot_state.target_symbols:
                        # Includiamo il side (long o short) per il frontend
                        pos_dict[p.symbol] = {"qty": float(p.qty), "market_value": float(p.market_value), "side": p.side.upper()}
                        
                # Calcoliamo il portfolio_value virtuale per lo status (market_value dello short è già negativo)
                pos_market_value = sum(float(p.market_value) for p in positions if p.symbol in bot_state.target_symbols)
                virtual_portfolio_value = bot_state.virtual_cash + pos_market_value
            except Exception:
                # Silenzioso se Alpaca non è autorizzato o crasha
                pass

        # Per i simboli che non abbiamo, segniamo "LIQUID"
        for sym in bot_state.target_symbols:
            if sym not in pos_dict:
                pos_dict[sym] = "LIQUID"

        table_data = [
            {
                "symbol": sym,
                "position": pos_dict[sym],
                "prediction": bot_state.latest_predictions.get(sym, "In attesa"),
                "sentiment": bot_state.ai_sentiment.get(sym, "NEUTRAL"),
            }
            for sym in bot_state.target_symbols
        ]

        win_rate = 0.0
        profit_factor = 0.0
        sharpe_ratio = 0.0
        max_drawdown = 0.0
        if bot_state.trade_history:
            wins = [t for t in bot_state.trade_history if t.get("profit_usd", 0) > 0]
            losses = [t for t in bot_state.trade_history if t.get("profit_usd", 0) <= 0]
            win_rate = round((len(wins) / len(bot_state.trade_history)) * 100, 1)
            
            gross_profit = sum(t["profit_usd"] for t in wins)
            gross_loss = abs(sum(t["profit_usd"] for t in losses))
            profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)
            
            # Approssimazione Sharpe Ratio basata sui trade
            returns = [t.get("profit_usd", 0) for t in bot_state.trade_history]
            if len(returns) > 2:
                import numpy as np
                mean_return = np.mean(returns)
                std_return = np.std(returns)
                sharpe_ratio = round((mean_return / std_return) * np.sqrt(252), 2) if std_return > 0 else 0.0
                
        # Drawdown da high watermarks
        current_val = bot_state.virtual_cash
        high_val = getattr(bot_state, 'high_watermarks', {}).get("daily", current_val)
        if high_val > current_val:
            max_drawdown = round(((high_val - current_val) / high_val) * 100, 2)

        market_open = False
        alpaca_info = {"status": "Scollegato", "account_number": "N/A", "type": "N/A"}
        try:
            if alpaca:
                clock = alpaca.get_clock()
                market_open = clock.is_open
                
                account = alpaca.get_account()
                alpaca_info["account_number"] = account.account_number
                alpaca_info["status"] = account.status
                is_paper = "paper" in os.getenv("ALPACA_BASE_URL", "").lower()
                alpaca_info["type"] = "PAPER" if is_paper else "LIVE"
        except Exception:
            pass

        # Fallback orario se l'API Alpaca fallisce
        try:
            from datetime import datetime, timedelta
            # NY time is roughly UTC-4 in summer
            now = datetime.utcnow() - timedelta(hours=4)
            fallback_open = now.weekday() < 5 and (now.hour > 9 or (now.hour == 9 and now.minute >= 30)) and now.hour < 16
            if not market_open:
                market_open = fallback_open
        except Exception:
            pass

        return {
            "is_running": bot_state.is_running,
            "portfolio_value": round(virtual_portfolio_value, 2),
            "profit": round(virtual_portfolio_value - 100.0, 2),
            "profit_perc": round((virtual_portfolio_value - 100.0) / 100.0 * 100, 2),
            "table_data": table_data,
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "sharpe_ratio": sharpe_ratio,
            "max_drawdown": max_drawdown,
            "market_open": market_open,
            "positions": pos_dict,
            "predictions": bot_state.latest_predictions,
            "last_trade": bot_state.last_trade,
            "cash": round(bot_state.virtual_cash, 2),
            "symbols": bot_state.target_symbols,
            "symbol_selection": getattr(bot_state, "symbol_selection", {}),
            "logs": bot_state.logs,
            "alpaca_info": alpaca_info,
            "aggressiveness": bot_state.aggressiveness,
            "trade_history": bot_state.trade_history,
            "modules": bot_state.modules,
            "auto_bet_enabled": bot_state.auto_bet_enabled,
            "auto_bet_threshold": bot_state.auto_bet_threshold,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "high_risk_arb_logs": getattr(bot_state, "high_risk_arb_logs", []),
            "high_risk_arb_prices": getattr(bot_state, "high_risk_arb_prices", {}),
            "high_risk_volatile_assets": getattr(bot_state, "high_risk_volatile_assets", []),
            "monitored_positions": getattr(bot_state, "monitored_positions", []),
            "reentry_watchlist": getattr(bot_state, "reentry_watchlist", []),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "value_bets": getattr(bot_state, "value_bets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", []),
            "ai_investments": getattr(bot_state, "ai_investments", [])
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
async def toggle_module(payload: dict, _: str = Depends(require_admin)):
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
                global_executor.submit(ai_engine.loop)
            elif module_name == "sports_arb" and not sports_engine.running:
                global_executor.submit(sports_engine.loop)
                bot_state.add_log("⚽ Modulo Sports Arbitrage avviato.")
            elif module_name == "ai_sports_sentiment":
                if sentiment_engine is None:
                    bot_state.modules[mod_id] = False
                    bot_state.save_state()
                    return {"error": "Modulo AI Sentiment Radar non disponibile in questa build"}
                if not getattr(sentiment_engine, "running", False):
                    global_executor.submit(sentiment_engine.loop)
                    bot_state.add_log("📡 Modulo AI Sentiment Radar avviato.")
            elif (module_name == "crypto_arb" or module_name == "high_risk_crypto_arb") and not arb_engine.running:
                global_executor.submit(arb_engine.loop)
                
            if module_name == "high_risk_crypto_arb":
                bot_state.high_risk_arb_logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] 🚀 Motore Alto Rischio Avviato (Ricerca memecoin volatili...)")
                if len(bot_state.high_risk_arb_logs) > 50:
                    bot_state.high_risk_arb_logs.pop()
            elif module_name == "trading" and not alpaca_engine.running:
                bot_state.is_running = True
                global_executor.submit(alpaca_engine.loop)
        else:
            if module_name == "sports_arb":
                sports_engine.stop()
                bot_state.add_log("⚽ Modulo Sports Arbitrage fermato.")
            elif module_name == "ai_sports_sentiment":
                if sentiment_engine is not None:
                    sentiment_engine.stop()
                    bot_state.add_log("📡 Modulo AI Sentiment Radar fermato.")
            elif module_name == "trading":
                bot_state.is_running = False
            elif module_name == "high_risk_crypto_arb":
                bot_state.high_risk_arb_logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] 🛑 Motore Alto Rischio Fermato.")
                if len(bot_state.high_risk_arb_logs) > 50:
                    bot_state.high_risk_arb_logs.pop()
                
        current_state = get_status()
        return {"message": "Modulo aggiornato", "modules": bot_state.modules,
            "arb_logs": getattr(bot_state, "arb_logs", []),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "high_risk_arb_logs": getattr(bot_state, "high_risk_arb_logs", []),
            "high_risk_arb_prices": getattr(bot_state, "high_risk_arb_prices", {}),
            "table_data": current_state.get("table_data", []) if "error" not in current_state else [],
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "value_bets": getattr(bot_state, "value_bets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])}
    return {"error": "Modulo non trovato"}
@app.get("/api/stock/quote/{symbol}")
def get_stock_quote(symbol: str):
    """Restituisce la quotazione in tempo reale tramite Alpaca (o yfinance come fallback)."""
    symbol = symbol.upper().strip()
    try:
        import alpaca_trade_api as tradeapi
        # Prova con Alpaca prima se configurata
        global alpaca
        if alpaca:
            bar = alpaca.get_latest_trade(symbol)
            if bar:
                return {"symbol": symbol, "price": float(bar.price)}
    except Exception as e:
        pass
        
    # Fallback su yfinance
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="1d")
        if not data.empty:
            price = data['Close'].iloc[-1]
            return {"symbol": symbol, "price": float(price)}
    except Exception as e:
        pass
        
    return {"error": f"Impossibile recuperare la quotazione per {symbol}"}

@app.get("/api/landing-ticker")
def get_landing_ticker():
    """Restituisce un piccolo set di quotazioni live per il ticker della landing page."""
    instruments = [
        {"market": "BTC/USD", "symbol": "BTC-USD"},
        {"market": "ETH/USD", "symbol": "ETH-USD"},
        {"market": "SOL/USD", "symbol": "SOL-USD"},
        {"market": "GOLD", "symbol": "GC=F"},
        {"market": "NASDAQ", "symbol": "^IXIC"},
        {"market": "EUR/USD", "symbol": "EURUSD=X"},
    ]

    results = []
    for item in instruments:
        symbol = item["symbol"]
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="5d")
            if data.empty or "Close" not in data:
                raise ValueError("Nessun dato disponibile")

            closes = data["Close"].dropna()
            if closes.empty:
                raise ValueError("Serie prezzi vuota")

            current_price = float(closes.iloc[-1])
            previous_price = float(closes.iloc[-2]) if len(closes) > 1 else current_price
            change_pct = ((current_price - previous_price) / previous_price * 100) if previous_price else 0.0

            if symbol.startswith("^"):
                price_label = f"{current_price:,.0f}"
            elif current_price >= 1000:
                price_label = f"${current_price:,.0f}"
            elif current_price >= 100:
                price_label = f"${current_price:,.2f}"
            elif current_price >= 1:
                price_label = f"${current_price:,.2f}"
            else:
                price_label = f"{current_price:,.4f}"

            results.append({
                "market": item["market"],
                "price": price_label,
                "change": f"{change_pct:+.2f}%",
                "direction": "up" if change_pct >= 0 else "down",
            })
        except Exception:
            continue

    if not results:
        return {
            "items": [
                {"market": "BTC/USD", "price": "$118,420", "change": "+2.6%", "direction": "up"},
                {"market": "ETH/USD", "price": "$6,180", "change": "+1.9%", "direction": "up"},
                {"market": "SOL/USD", "price": "$242", "change": "+4.2%", "direction": "up"},
                {"market": "GOLD", "price": "$2,612", "change": "-0.4%", "direction": "down"},
                {"market": "NASDAQ", "price": "21,440", "change": "+0.8%", "direction": "up"},
                {"market": "EUR/USD", "price": "1.11", "change": "+0.2%", "direction": "up"},
            ]
        }

    return {"items": results}

@app.post("/api/stock/trade/manual")
def manual_stock_trade(payload: dict, _: str = Depends(require_admin)):
    """Esegue un trade azionario manuale in paper trading."""
    symbol = payload.get("symbol", "").upper().strip()
    side = payload.get("side", "buy").lower()
    amount = float(payload.get("amount", 0))
    
    if not symbol or side not in ["buy", "sell"] or amount <= 0:
        return {"error": "Parametri non validi"}
        
    # Ottieni prezzo
    quote = get_stock_quote(symbol)
    if "error" in quote:
        return quote
        
    price = quote["price"]
    qty = amount / price
    
    # Esegui in Paper Mode (virtual_cash)
    if side == "buy":
        if bot_state.virtual_cash < amount:
            return {"error": "Fondi virtuali insufficienti"}
        bot_state.virtual_cash -= amount
        
        # Aggiungi a monitored positions se l'utente vuole che il bot gestisca l'uscita
        bot_state.monitored_positions.append({
            "symbol": symbol,
            "buy_price": price,
            "qty": qty,
            "amount": amount,
            "peak_price": price,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
        
        _send_telegram_trade(
            event="BUY", symbol=symbol, qty=qty, price=price,
            reason="Trade Azionario Manuale", virtual_cash=bot_state.virtual_cash
        )
        return {"status": "ok", "message": f"Acquistate {qty:.4f} {symbol} a ${price:.2f}"}
    else:
        # SELL manuale
        # Trova la posizione in monitored_positions
        pos_idx = -1
        for i, p in enumerate(bot_state.monitored_positions):
            if p["symbol"].upper() == symbol:
                pos_idx = i
                break
                
        if pos_idx == -1:
            return {"error": f"Nessuna posizione aperta trovata per {symbol}"}
            
        pos = bot_state.monitored_positions.pop(pos_idx)
        revenue = pos["qty"] * price
        profit = revenue - pos["amount"]
        
        bot_state.virtual_cash += revenue
        bot_state.profit += profit
        
        _send_telegram_trade(
            event="SELL", symbol=symbol, qty=pos["qty"], price=price,
            reason=f"Chiusura Manuale Azionario", virtual_cash=bot_state.virtual_cash
        )
        
        return {"status": "ok", "message": f"Vendute {pos['qty']:.4f} {symbol} a ${price:.2f}. Profitto: ${profit:.2f}"}


@app.post("/api/high-risk/trade")
async def high_risk_trade(payload: dict, _: str = Depends(require_admin)):
    """
    Endpoint per trading manuale rapido nella sezione HIGH RISK.
    Accetta: symbol (es. "DOGEUSDT"), side ("buy"/"sell"), amount (USD)
    """
    symbol = payload.get("symbol", "").upper()
    side = payload.get("side", "buy")
    amount = float(payload.get("amount", 100))
    
    if not symbol or side not in ["buy", "sell"]:
        return {"error": "Parametri non validi (symbol, side, amount)"}
    
    try:
        price = 0.0
        # Cerca il prezzo corrente dalla lista degli asset volatili
        for asset in getattr(bot_state, "high_risk_volatile_assets", []):
            if asset["symbol"].upper() == symbol.upper():
                price = float(asset["price"])
                break
        # Fallback: cerca nei prezzi dell'arbitraggio
        if price == 0.0:
            prices = getattr(bot_state, "high_risk_arb_prices", {})
            if symbol in prices:
                price = float(prices[symbol].get("binance", 0) or prices[symbol].get("kraken", 0))
                
        if price == 0.0:
            return {"error": f"Prezzo non disponibile per {symbol}. Il motore HIGH RISK deve essere attivo."}

        qty = amount / price
        
        # Paper Mode: simula il bilancio virtuale
        if side == "buy":
            if bot_state.virtual_cash < amount:
                return {"error": "Fondi virtuali insufficienti"}
            bot_state.virtual_cash -= amount
            # Registra in sorveglianza per auto-exit
            bot_state.monitored_positions.append({
                "symbol": symbol,
                "buy_price": price,
                "qty": qty,
                "amount": amount,
                "peak_price": price,
                "timestamp": datetime.now().strftime("%H:%M:%S")
            })
            bot_state.high_risk_arb_logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] ⚡ SCALP BUY {symbol} {qty:.4f} @ ${price:.6f} (${amount:.2f}) — 👁️ IN SORVEGLIANZA")
            _send_telegram_trade(
                event="BUY", symbol=symbol, qty=qty, price=price,
                reason="Acquisto manuale rapido", virtual_cash=bot_state.virtual_cash
            )
        else:
            # Cerca ed elimina posizione monitorata per questo simbolo
            current_value = qty * price
            realized_profit = current_value - amount
            bot_state.virtual_cash += current_value
            # Rimuovi eventuali posizioni monitorate per questo symbol
            bot_state.monitored_positions = [p for p in bot_state.monitored_positions if p["symbol"].upper() != symbol.upper()]
            pct_str = f"+{realized_profit:.2f}" if realized_profit >= 0 else f"{realized_profit:.2f}"
            bot_state.high_risk_arb_logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] 💰 SCALP SELL {symbol} {qty:.4f} @ ${price:.6f} ({pct_str}$) — posizione chiusa")
            _send_telegram_trade(
                event="SELL", symbol=symbol, qty=qty, price=price,
                profit_usd=realized_profit, reason="Vendita manuale rapida",
                virtual_cash=bot_state.virtual_cash
            )
            
        bot_state.save_state()
        
        return {
            "status": "ok",
            "symbol": symbol,
            "side": side,
            "qty": round(qty, 6),
            "price": price,
            "amount": amount,
            "virtual_cash": round(bot_state.virtual_cash, 2),
            "monitored": side == "buy"
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/high-risk/set-target")
async def high_risk_set_target(payload: dict, _: str = Depends(require_admin)):
    """Imposta o aggiorna il target price su una posizione monitorata."""
    symbol       = payload.get("symbol", "").upper()
    target_price = payload.get("target_price", None)

    if not symbol:
        return {"error": "Symbol mancante"}

    found = False
    for pos in bot_state.monitored_positions:
        if pos["symbol"].upper() == symbol:
            pos["target_price"] = float(target_price) if target_price else None
            found = True
            break

    if not found:
        return {"error": f"Nessuna posizione aperta per {symbol}"}

    label = f"${float(target_price):.8f}" if target_price else "rimosso"
    bot_state.high_risk_arb_logs.insert(0,
        f"[{datetime.now().strftime('%H:%M:%S')}] 🎯 TARGET impostato su {symbol}: {label}")
    return {"status": "ok", "symbol": symbol, "target_price": float(target_price) if target_price else None}


@app.post("/api/high-risk/cancel-reentry")
async def high_risk_cancel_reentry(payload: dict, _: str = Depends(require_admin)):
    """Rimuove un simbolo dalla re-entry watchlist."""
    symbol = payload.get("symbol", "").upper()
    if not symbol:
        return {"error": "Symbol mancante"}

    before = len(bot_state.reentry_watchlist)
    bot_state.reentry_watchlist = [w for w in bot_state.reentry_watchlist if w["symbol"].upper() != symbol]
    removed = before - len(bot_state.reentry_watchlist)
    if removed == 0:
        return {"error": f"{symbol} non trovato nella re-entry watchlist"}
    bot_state.high_risk_arb_logs.insert(0,
        f"[{datetime.now().strftime('%H:%M:%S')}] ❌ RE-ENTRY annullato per {symbol}")
    return {"status": "ok", "symbol": symbol, "removed": removed}


@app.post("/api/high-risk/ai-signal")
async def high_risk_ai_signal(payload: dict, _: str = Depends(require_admin)):
    """
    Chiede a Groq LLaMA un'analisi tecnica e sentiment su un crypto token.
    Restituisce: signal (BUY/SELL/HOLD), confidence, reasoning, target_price, stop_loss
    """
    symbol = payload.get("symbol", "").upper()
    price = float(payload.get("price", 0))
    volatility = float(payload.get("volatility", 0))
    change_24h = float(payload.get("change_24h", 0))
    
    if not symbol:
        return {"error": "Symbol mancante"}
    
    try:
        # Carica la chiave Groq
        keys = {}
        keys_file = os.path.join(os.path.dirname(__file__), ".env.keys")
        try:
            with open(keys_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line:
                        k, v = line.split("=", 1)
                        keys[k.strip()] = v.strip()
        except Exception:
            pass
        
        groq_key = keys.get("GROQ_KEY", "")
        if not groq_key:
            return {"error": "Chiave GROQ non configurata. Aggiungila nelle Impostazioni."}
        
        from groq import Groq
        client = Groq(api_key=groq_key)
        
        direction_hint = "rialzista" if change_24h > 0 else "ribassista"
        
        prompt = f"""Sei un trader crypto professionale specializzato in altcoins ad alta volatilità.
Analizza questo asset e dammi un segnale operativo preciso.

Token: {symbol}
Prezzo attuale: ${price}
Variazione 24h: {change_24h:+.2f}%
Volatilità 24h (range H/L): {volatility:.1f}%
Trend intraday: {direction_hint}

Rispondi SOLO in questo formato JSON (nessun altro testo):
{{
  "signal": "BUY" oppure "SELL" oppure "HOLD",
  "confidence_score": numero intero da 1 a 100 (es. 85 per alta confidenza),
  "reasoning": "spiegazione breve in italiano (max 2 frasi)",
  "entry_price": prezzo di ingresso suggerito (numero),
  "target_price": prezzo obiettivo (numero),
  "stop_loss": prezzo di stop loss (numero)
}}"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=250,
        )
        
        raw = response.choices[0].message.content.strip()
        # Estrai il JSON dalla risposta
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "symbol": symbol,
                "signal": data.get("signal", "HOLD"),
                "confidence": int(data.get("confidence_score", 50)),
                "reasoning": data.get("reasoning", "Analisi non disponibile"),
                "entry_price": float(data.get("entry_price", price)),
                "target_price": float(data.get("target_price", price)),
                "stop_loss": float(data.get("stop_loss", price))
            }
        else:
            return {"error": "Risposta AI non parsabile", "raw": raw}
            
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/auto-bet-settings")
async def update_auto_bet_settings(payload: dict, _: str = Depends(require_admin)):
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
async def place_bet(payload: dict, _: str = Depends(require_admin)):
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
def start_bot(_: str = Depends(require_admin)):
    if not alpaca_engine: raise HTTPException(status_code=500, detail="Alpaca non configurata")
    if not bot_state.is_running:
        try:
            selected = refresh_target_symbols(max_symbols=7)
            bot_state.add_log(f"🎯 Watchlist aggiornata: {', '.join(selected)}")
        except Exception as e:
            bot_state.add_log(f"⚠️ Ranking watchlist fallito, uso fallback: {e}")
        bot_state.is_running = True
        bot_state.add_log("Avvio scanner Multi-Asset (Alpaca Quant Engine)...")
        global_executor.submit(alpaca_engine.loop)
    return {"message": "Bot avviato", "state": get_status()}

@app.post("/api/config")
async def update_config(config: dict, _: str = Depends(require_admin)):
    if "aggressiveness" in config:
        bot_state.aggressiveness = float(config["aggressiveness"])
        bot_state.save_state()
        bot_state.add_log(f"Aggressività IA impostata al {bot_state.aggressiveness}%")
        return {"message": "Configurazione aggiornata", "aggressiveness": bot_state.aggressiveness}
    if config.get("refresh_symbols"):
        symbol_count = int(config.get("symbol_count", 7))
        symbol_count = max(3, min(symbol_count, 12))
        selected = refresh_target_symbols(max_symbols=symbol_count)
        bot_state.add_log(f"🎯 Nuova selezione titoli: {', '.join(selected)}")
        return {
            "message": "Watchlist aggiornata",
            "symbols": selected,
            "symbol_selection": bot_state.symbol_selection,
        }
    return {"error": "Parametri non validi"}

@app.post("/api/stop")
def stop_bot(_: str = Depends(require_admin)):
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
def reset_simulation(_: str = Depends(require_admin)):
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

        try:
            import yfinance as yf
            ticker = yf.Ticker(sym)
            df = ticker.history(interval=interval, period=period)
        except Exception as e:
            print(f"Errore in yfinance per {sym}: {e}")
            import pandas as pd
            df = pd.DataFrame()

        if df.empty:
            # Fallback in caso di blocco IP da parte di Yahoo Finance
            try:
                import pandas as pd
                if "-" in sym or "/" in sym:
                    import ccxt
                    exchange = ccxt.binance()
                    s = sym.replace("-", "/")
                    if s.endswith("/USD"): s = s.replace("/USD", "/USDT")
                    tf_map = {"5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d", "1wk": "1w"}
                    ohlcv = exchange.fetch_ohlcv(s, timeframe=tf_map.get(interval, "1h"), limit=100)
                    df = pd.DataFrame(ohlcv, columns=['timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'])
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                    df.set_index('timestamp', inplace=True)
                elif alpaca:
                    import alpaca_trade_api as tradeapi
                    from datetime import datetime, timedelta
                    tf_map = {"5m": tradeapi.TimeFrame.Minute, "15m": tradeapi.TimeFrame.Minute, "1h": tradeapi.TimeFrame.Hour, "1d": tradeapi.TimeFrame.Day, "1wk": tradeapi.TimeFrame.Day}
                    days = 30
                    if period == "1d": days = 2
                    elif period == "5d": days = 7
                    end_dt = datetime.now()
                    start_dt = end_dt - timedelta(days=days)
                    bars = alpaca.get_bars(sym, tf_map.get(interval, tradeapi.TimeFrame.Hour), start=start_dt.strftime('%Y-%m-%d'), end=end_dt.strftime('%Y-%m-%d')).df
                    if not bars.empty:
                        bars.rename(columns={'close': 'Close'}, inplace=True)
                        df = bars
            except Exception as e:
                pass

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
API_KEYS_FILE = os.path.join(os.path.dirname(__file__), ".env.keys")
BILLING_DB_FILE = os.path.join(os.path.dirname(__file__), "billing_db.json")

# Se il file non esiste, creiamolo vuoto
if not os.path.exists(API_KEYS_FILE):
    with open(API_KEYS_FILE, "w") as f:
        f.write("ALPACA_KEY=\n")
        f.write("ALPACA_SECRET=\n")
        f.write("BINANCE_KEY=\n")
        f.write("BINANCE_SECRET=\n")
        f.write("THEODDS_KEY=\n")
        f.write("KRAKEN_KEY=\n")
        f.write("KRAKEN_SECRET=\n")
        f.write("ELEVENLABS_KEY=\n")


def _default_billing_plans():
    return [
        {
            "id": "starter",
            "name": "Starter",
            "price_monthly": 79,
            "currency": "EUR",
            "description": "Per trader indipendenti che vogliono dashboard e demo operativa.",
            "features": ["Dashboard live", "Demo mode", "1 workspace", "Supporto email"],
            "modules": ["dashboard", "trading"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_STARTER_URL", "https://buy.stripe.com/test_starter"),
        },
        {
            "id": "pro",
            "name": "Pro",
            "price_monthly": 199,
            "currency": "EUR",
            "description": "Per utenti che vogliono automazioni, segnali e moduli avanzati.",
            "features": ["Tutti i moduli core", "Alert operativi", "3 workspace", "Priority support"],
            "modules": ["dashboard", "trading", "defi", "sentiment"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_PRO_URL", "https://buy.stripe.com/test_pro"),
        },
        {
            "id": "elite",
            "name": "Elite",
            "price_monthly": 499,
            "currency": "EUR",
            "description": "Per desk, consulenti e clienti ad alto valore con onboarding guidato.",
            "features": ["White-glove onboarding", "Utenti multipli", "Billing priority", "Canale dedicato"],
            "modules": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_ELITE_URL", "https://buy.stripe.com/test_elite"),
        },
    ]


def load_billing_db():
    default_data = {
        "plans": _default_billing_plans(),
        "customers": [
            {
                "id": "cus_demo_alpha",
                "company": "Alpha Quant Studio",
                "contact_name": "Marco Rossi",
                "email": "marco@alphaquant.studio",
                "plan_id": "pro",
                "status": "active",
                "seats": 3,
                "monthly_amount": 199,
                "started_at": "2026-06-12",
                "next_billing_at": "2026-07-12",
                "modules_enabled": ["dashboard", "trading", "defi", "sentiment"],
                "source": "direct",
            },
            {
                "id": "cus_demo_beta",
                "company": "Beta Capital Lab",
                "contact_name": "Giulia Bianchi",
                "email": "giulia@betacapitallab.com",
                "plan_id": "starter",
                "status": "trialing",
                "seats": 1,
                "monthly_amount": 79,
                "started_at": "2026-07-01",
                "next_billing_at": "2026-07-08",
                "modules_enabled": ["dashboard", "trading"],
                "source": "demo",
            },
        ],
        "leads": [
            {
                "id": "lead_demo_1",
                "company": "Omega Signals",
                "contact_name": "Luca Verdi",
                "email": "luca@omegasignals.io",
                "plan_id": "elite",
                "status": "lead",
                "created_at": "2026-07-02",
                "source": "website",
            }
        ],
        "recent_activity": [
            {"id": "act_1", "type": "trial_started", "label": "Beta Capital Lab ha avviato un trial Pro", "created_at": "2026-07-01 10:20"},
            {"id": "act_2", "type": "lead_captured", "label": "Nuovo lead acquisito da landing page", "created_at": "2026-07-02 18:10"},
        ],
        "settings": {"trial_days": 7, "currency": "EUR"},
    }
    if not os.path.exists(BILLING_DB_FILE):
        return default_data
    try:
        with open(BILLING_DB_FILE, "r") as f:
            data = json.load(f)
            return {
                "plans": data.get("plans", default_data["plans"]),
                "customers": data.get("customers", default_data["customers"]),
                "leads": data.get("leads", default_data["leads"]),
                "recent_activity": data.get("recent_activity", default_data["recent_activity"]),
                "settings": {**default_data["settings"], **data.get("settings", {})},
            }
    except Exception:
        return default_data


def save_billing_db(data):
    with open(BILLING_DB_FILE, "w") as f:
        json.dump(data, f)


def build_billing_overview():
    billing = load_billing_db()
    plans = billing["plans"]
    customers = billing["customers"]
    leads = billing["leads"]
    active_customers = [c for c in customers if c.get("status") == "active"]
    trialing_customers = [c for c in customers if c.get("status") == "trialing"]
    monthly_recurring_revenue = round(sum(float(c.get("monthly_amount", 0) or 0) for c in active_customers), 2)
    annual_run_rate = round(monthly_recurring_revenue * 12, 2)
    total_accounts = len(customers)
    paid_accounts = len(active_customers)
    collection_rate = round((paid_accounts / total_accounts) * 100, 1) if total_accounts else 0.0
    return {
        "metrics": {
            "active_customers": len(active_customers),
            "trialing_customers": len(trialing_customers),
            "monthly_recurring_revenue": monthly_recurring_revenue,
            "annual_run_rate": annual_run_rate,
            "leads_count": len(leads),
            "collection_rate": collection_rate,
        },
        "plans": plans,
        "customers": customers,
        "leads": leads,
        "recent_activity": billing["recent_activity"][:8],
        "settings": billing["settings"],
    }

def append_billing_activity(label: str, activity_type: str = "admin_update"):
    billing = load_billing_db()
    billing["recent_activity"].insert(0, {
        "id": f"act_{uuid4().hex[:8]}",
        "type": activity_type,
        "label": label,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    billing["recent_activity"] = billing["recent_activity"][:20]
    save_billing_db(billing)

class LoginRequest(BaseModel):
    email: Optional[str] = None
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    plan_id: Optional[str] = "pro"


class PasskeyCredentialAttestationRequest(BaseModel):
    client_data_json: str
    attestation_object: str


class PasskeyCredentialAssertionRequest(BaseModel):
    client_data_json: str
    authenticator_data: str
    signature: str
    user_handle: str = ""


class PasskeyRegistrationRequest(BaseModel):
    request_id: str
    id: str
    raw_id: str
    type: str
    label: str = ""
    response: PasskeyCredentialAttestationRequest


class PasskeyAuthenticationRequest(BaseModel):
    request_id: str
    id: str
    raw_id: str
    type: str
    response: PasskeyCredentialAssertionRequest


class BillingLeadRequest(BaseModel):
    company: str
    email: str
    plan_id: str
    contact_name: str = ""
    seats: int = 1
    source: str = "manual"


import requests

DISPOSABLE_DOMAINS = set()
try:
    _res = requests.get("https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf", timeout=5)
    if _res.status_code == 200:
        DISPOSABLE_DOMAINS = set(line.strip().lower() for line in _res.text.splitlines() if line.strip() and not line.startswith("//"))
        print(f"Loaded {len(DISPOSABLE_DOMAINS)} disposable email domains.")
except Exception as e:
    print(f"Failed to load disposable domains: {e}")

class BillingCustomerStatusRequest(BaseModel):
    status: str

def get_plan_catalog() -> dict:
    return {plan["id"]: plan for plan in _default_billing_plans()}

def get_plan_for_user(plan_id: Optional[str]) -> dict:
    plans = get_plan_catalog()
    return plans.get(plan_id or "pro") or plans.get("pro") or next(iter(plans.values()))

@app.post("/api/register")
def register(req: RegisterRequest):
    # Genera user_id
    user_id = f"usr_{int(time.time())}"
    email = req.email.lower().strip() if req.email else ""
    selected_plan = get_plan_for_user(req.plan_id)
    
    # Check disposable
    if "@" in email:
        domain = email.split("@")[1]
        if domain in DISPOSABLE_DOMAINS:
            raise HTTPException(status_code=400, detail="L'utilizzo di email usa e getta non è consentito.")
            
    success = db.create_user(user_id, email, req.password, role="user", status="pending", plan_id=selected_plan["id"])
    if not success:
        raise HTTPException(status_code=400, detail="L'email è già registrata.")
    return {"status": "success", "message": f"Registrazione completata! Step {selected_plan['name']} associato al tuo account. Ora puoi fare il login per accedere alla Demo."}

@app.post("/api/login")
def login(req: LoginRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"
    assert_login_allowed(client_id)

    if not req.email:
        record_login_failure(client_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email richiesta per il login utente")

    email = req.email.lower().strip()
    user = db.verify_user_login(email, req.password)
    if user:
        clear_login_failures(client_id)
        plan = get_plan_for_user(user.get("plan_id"))
        token = create_user_token(user["id"], user["email"], user["role"])
        return {
            "status": "success", 
            "token": token, 
            "expires_in": 86400, 
            "role": user["role"],
            "user_status": user["status"],
            "plan_id": plan["id"],
            "allowed_modules": plan.get("modules", []),
        }

    record_login_failure(client_id)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide o accesso negato")


@app.post("/api/admin/login")
def admin_login(req: LoginRequest, request: Request):
    client_id = f"admin:{request.client.host}" if request.client else "admin:unknown"
    assert_login_allowed(client_id)

    if not req.password:
        record_login_failure(client_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password admin richiesta")

    if is_admin_configured() and verify_admin_password(req.password):
        clear_login_failures(client_id)
        token = create_admin_session()
        return {"status": "success", "token": token, "expires_in": 86400, "role": "admin"}

    record_login_failure(client_id)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali admin non valide")


@app.post("/api/logout")
def logout(admin_token: str = Depends(require_admin)):
    revoke_admin_session(admin_token)
    return {"status": "success"}


@app.get("/api/passkeys/status")
def passkeys_status(_: str = Depends(require_admin)):
    return get_passkey_status()


@app.post("/api/passkeys/register/options")
def passkeys_register_options(request: Request, admin_token: str = Depends(require_admin)):
    return begin_passkey_registration(request, admin_token)


@app.post("/api/passkeys/register/verify")
def passkeys_register_verify(req: PasskeyRegistrationRequest, admin_token: str = Depends(require_admin)):
    return finish_passkey_registration(req.model_dump(), admin_token)


@app.post("/api/passkeys/auth/options")
def passkeys_auth_options(request: Request):
    return begin_passkey_authentication(request)


@app.post("/api/passkeys/auth/verify")
def passkeys_auth_verify(req: PasskeyAuthenticationRequest, request: Request):
    return finish_passkey_authentication(req.model_dump(), request)


@app.post("/api/saas/lead")
def create_saas_lead(req: BillingLeadRequest, _: str = Depends(require_admin)):
    billing = load_billing_db()
    plans = {plan["id"]: plan for plan in billing["plans"]}
    selected_plan = plans.get(req.plan_id)
    if not selected_plan:
        raise HTTPException(status_code=404, detail="Piano non trovato")

    lead = {
        "id": f"lead_{uuid4().hex[:8]}",
        "company": req.company.strip(),
        "contact_name": req.contact_name.strip(),
        "email": req.email.strip().lower(),
        "plan_id": req.plan_id,
        "status": "lead",
        "created_at": datetime.now().strftime("%Y-%m-%d"),
        "source": req.source,
        "seats": max(1, int(req.seats or 1)),
    }
    billing["leads"].insert(0, lead)
    billing["recent_activity"].insert(0, {
        "id": f"act_{uuid4().hex[:8]}",
        "type": "lead_created",
        "label": f"Lead creato per {lead['company']} sul piano {selected_plan['name']}",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    billing["recent_activity"] = billing["recent_activity"][:20]
    save_billing_db(billing)
    return {"status": "success", "lead": lead, "overview": build_billing_overview()}


@app.post("/api/saas/customer/{customer_id}/status")
def update_saas_customer_status(customer_id: str, req: BillingCustomerStatusRequest, _: str = Depends(require_admin)):
    billing = load_billing_db()
    allowed_statuses = {"lead", "trialing", "active", "past_due", "canceled"}
    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Status non valido")

    updated = None
    for record_group in ("customers", "leads"):
        for item in billing[record_group]:
            if item.get("id") == customer_id:
                item["status"] = req.status
                if req.status in {"trialing", "active"} and record_group == "leads":
                    plans = {plan["id"]: plan for plan in billing["plans"]}
                    plan = plans.get(item["plan_id"], {})
                    customer = {
                        "id": f"cus_{uuid4().hex[:8]}",
                        "company": item.get("company"),
                        "contact_name": item.get("contact_name"),
                        "email": item.get("email"),
                        "plan_id": item.get("plan_id"),
                        "status": req.status,
                        "seats": item.get("seats", 1),
                        "monthly_amount": plan.get("price_monthly", 0),
                        "started_at": datetime.now().strftime("%Y-%m-%d"),
                        "next_billing_at": datetime.now().strftime("%Y-%m-%d"),
                        "modules_enabled": plan.get("modules", []),
                        "source": item.get("source", "manual"),
                    }
                    billing["customers"].insert(0, customer)
                    billing["leads"] = [lead for lead in billing["leads"] if lead.get("id") != customer_id]
                    updated = customer
                else:
                    updated = item
                break
        if updated:
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Cliente o lead non trovato")

    billing["recent_activity"].insert(0, {
        "id": f"act_{uuid4().hex[:8]}",
        "type": "status_updated",
        "label": f"{updated.get('company', 'Record')} aggiornato a {req.status.upper()}",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    billing["recent_activity"] = billing["recent_activity"][:20]
    save_billing_db(billing)
    return {"status": "success", "record": updated, "overview": build_billing_overview()}

class KeysRequest(BaseModel):
    alpaca_key: str = ""
    alpaca_secret: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""
    elevenlabs_key: str = ""
    theodds_key: str = ""
    groq_key: str = ""
    newsapi_key: str = ""
    google_cloud_json: str = ""


@app.get("/api/keys")
def get_keys(user: dict = Depends(require_user)):
    keys = {}
    try:
        def mask_value(value: str) -> str:
            if not value:
                return ""
            return value[:4] + "*" * 10 if len(value) > 4 else "***"

        env_keys = {}
        # Global AI keys (masked) per tutti, lette dal file .env
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        env_keys[k] = v
                        if v and k in ["ELEVENLABS_KEY", "THEODDS_KEY", "GROQ_KEY", "NEWSAPI_KEY"]:
                            keys[k] = mask_value(v)
        if os.path.exists(".env.gcp.json"):
            keys["GOOGLE_APPLICATION_CREDENTIALS"] = "MASKED_JSON"
            
        # Per le chiavi di trading leggiamo prima il DB utente
        user_keys = db.get_api_keys(user["sub"])
        if user_keys:
            if user_keys.get("alpaca_key"): keys["ALPACA_KEY"] = mask_value(user_keys["alpaca_key"])
            if user_keys.get("alpaca_secret"): keys["ALPACA_SECRET"] = mask_value(user_keys["alpaca_secret"])
            if user_keys.get("binance_key"): keys["BINANCE_KEY"] = mask_value(user_keys["binance_key"])
            if user_keys.get("binance_secret"): keys["BINANCE_SECRET"] = mask_value(user_keys["binance_secret"])
            if user_keys.get("kraken_key"): keys["KRAKEN_KEY"] = mask_value(user_keys["kraken_key"])
            if user_keys.get("kraken_secret"): keys["KRAKEN_SECRET"] = mask_value(user_keys["kraken_secret"])

        # Per l'admin facciamo fallback alle chiavi legacy in .env,
        # così la UI mostra "Presente" anche se il test legge ancora da lì.
        if user.get("role") == "admin":
            legacy_pairs = [
                ("ALPACA_KEY", "ALPACA_KEY"),
                ("ALPACA_SECRET", "ALPACA_SECRET"),
                ("BINANCE_KEY", "BINANCE_KEY"),
                ("BINANCE_SECRET", "BINANCE_SECRET"),
                ("KRAKEN_KEY", "KRAKEN_KEY"),
                ("KRAKEN_SECRET", "KRAKEN_SECRET"),
            ]
            for output_key, env_key in legacy_pairs:
                if not keys.get(output_key) and env_keys.get(env_key):
                    keys[output_key] = mask_value(env_keys[env_key])
    except Exception as e:
        keys["ERROR"] = str(e)
    return keys

@app.post("/api/keys")
def save_keys(req: KeysRequest, user: dict = Depends(require_user)):
    try:
        # 1. Salva chiavi di trading nel database per l'utente
        user_keys = db.get_api_keys(user["sub"]) or {}
        
        def merge_user_key(incoming_val, db_val):
            if not incoming_val or "***" in incoming_val:
                return db_val or ""
            return incoming_val

        db.save_api_keys(
            user_id=user["sub"],
            alpaca_key=merge_user_key(req.alpaca_key, user_keys.get("alpaca_key")),
            alpaca_secret=merge_user_key(req.alpaca_secret, user_keys.get("alpaca_secret")),
            binance_key=merge_user_key(req.binance_key, user_keys.get("binance_key")),
            binance_secret=merge_user_key(req.binance_secret, user_keys.get("binance_secret")),
            kraken_key=merge_user_key(req.kraken_key, user_keys.get("kraken_key")),
            kraken_secret=merge_user_key(req.kraken_secret, user_keys.get("kraken_secret")),
        )

        # 2. Solo l'admin può salvare le chiavi globali AI in .env
        if user.get("role") == "admin":
            existing = {}
            if os.path.exists(API_KEYS_FILE):
                with open(API_KEYS_FILE, "r") as f:
                    for line in f:
                        if "=" in line:
                            k, v = line.strip().split("=", 1)
                            existing[k] = v
            
            def merge_global(key_name, incoming_val):
                if not incoming_val or "***" in incoming_val:
                    return existing.get(key_name, "")
                return incoming_val
                
            new_elevenlabs_key = merge_global("ELEVENLABS_KEY", req.elevenlabs_key)
            new_theodds_key = merge_global("THEODDS_KEY", req.theodds_key)
            new_groq_key = merge_global("GROQ_KEY", req.groq_key)
            new_newsapi_key = merge_global("NEWSAPI_KEY", req.newsapi_key)
            
            with open(API_KEYS_FILE, "w") as f:
                for k, v in existing.items():
                    if k not in ["ELEVENLABS_KEY", "THEODDS_KEY", "GROQ_KEY", "NEWSAPI_KEY"]:
                        f.write(f"{k}={v}\n")
                if new_elevenlabs_key: f.write(f"ELEVENLABS_KEY={new_elevenlabs_key}\n")
                if new_theodds_key: f.write(f"THEODDS_KEY={new_theodds_key}\n")
                if new_groq_key: f.write(f"GROQ_KEY={new_groq_key}\n")
                if new_newsapi_key: f.write(f"NEWSAPI_KEY={new_newsapi_key}\n")
                
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
    groq_key: str = ""

@app.post("/api/test-connection")
def test_connection(req: TestConnectionRequest, _: str = Depends(require_admin)):
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
    if req.groq_key and "***" not in req.groq_key: keys['GROQ_KEY'] = req.groq_key
    

    service = req.service.lower()
    
    try:
        if service == 'alpaca':
            import alpaca_trade_api as tradeapi
            api_key = keys.get("ALPACA_KEY", "")
            api_secret = keys.get("ALPACA_SECRET", "")
            if not api_key or not api_secret:
                return {"status": "error", "message": "Chiavi Alpaca mancanti."}
            api = tradeapi.REST(api_key, api_secret, base_url=BASE_URL)
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
        elif service == 'groq':
            api_key = keys.get("GROQ_KEY", "")
            if not api_key:
                return {"status": "error", "message": "Chiave Groq mancante."}
            try:
                from groq import Groq
                client = Groq(api_key=api_key)
                
                model_name = 'llama-3.1-8b-instant'
                res = client.chat.completions.create(
                    messages=[{"role": "user", "content": "Say hi in 1 word"}],
                    model=model_name
                )
                if res.choices[0].message.content:
                    return {"status": "success", "message": f"Connessione Groq stabilita! Modello: {model_name}"}
            except Exception as e:
                return {"status": "error", "message": f"Errore Groq: {str(e)}"}
                
        else:
            # Fallback for others
            return {"status": "success", "message": f"Simulazione test: Connessione a {service.upper()} riuscita!"}
            
    except Exception as e:
        return {"status": "error", "message": f"Errore di connessione: {str(e)}"}

class GenerateIdeaRequest(BaseModel):
    pass

@app.post("/api/ai/generate-idea")
def generate_idea(req: GenerateIdeaRequest = None):
    import random
    import requests
    import xml.etree.ElementTree as ET
    
    topic = "Bitcoin verso nuovi massimi, cosa dicono gli analisti" # fallback
    try:
        # Peschiamo vere news fresche dal feed RSS di CoinDesk o Cointelegraph
        res = requests.get("https://cointelegraph.com/rss", timeout=3)
        if res.status_code == 200:
            root = ET.fromstring(res.content)
            titles = [item.find('title').text for item in root.findall('./channel/item') if item.find('title') is not None]
            if titles:
                # Scegliamo una delle 10 news più recenti
                topic = random.choice(titles[:10])
    except Exception as e:
        print(f"Errore lettura news reali: {e}")
        
    script_part = f"Spiega questa news in ITALIANO (durata ~45 sec, possibilmente con sottotitoli stile TikTok).\nNews originale: '{topic}'"
    veo_prompt = f"Cinematic 4k realistic shot, dramatic lighting, dynamic motion, representing the financial news: {topic}"
    
    # Generazione dinamica Hashtag e Descrizione
    words = [w for w in topic.replace(',', '').replace(':', '').split() if len(w) > 4]
    dynamic_tags = [f"#{w}" for w in words[:3]]
    hashtags = " ".join(dynamic_tags + ["#AureoBot", "#Trading", "#Crypto"])
    description = f"Ultime notizie dai mercati! 🚨 {topic} Cosa ne pensi? Fammelo sapere nei commenti! 👇"
    
    return {"topic": topic, "script": script_part, "prompt": veo_prompt, "description": description, "hashtags": hashtags}

@app.post("/api/ai/upload-video")
async def upload_video(topic: str = Form(...), prompt: str = Form(...), description: str = Form(""), hashtags: str = Form(""), file: UploadFile = File(...), _: str = Depends(require_admin)):
    import uuid
    import shutil
    
    os.makedirs("uploads", exist_ok=True)
    filename = f"{uuid.uuid4()}.mp4"
    filepath = os.path.join("uploads", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    ai_engine.add_video_to_queue({
        "topic": topic,
        "prompt": prompt,
        "description": description,
        "hashtags": hashtags,
        "file_path": filepath,
        "created_at": time.time()
    })
    return {"status": "success", "message": "Video aggiunto alla coda di distribuzione"}

class SubmitTxidRequest(BaseModel):
    txid: str
    amount: float
    currency: str

def get_payment_wallets() -> dict:
    return {
        "BTC": (os.getenv("PAYMENT_WALLET_BTC") or "").strip(),
        "ETH": (os.getenv("PAYMENT_WALLET_ETH") or "").strip(),
        "USDC": (os.getenv("PAYMENT_WALLET_USDC") or "").strip(),
        "SOL": (os.getenv("PAYMENT_WALLET_SOL") or "").strip(),
        "USDT": (os.getenv("PAYMENT_WALLET_USDT") or "").strip(),
    }

def get_payment_wallet(currency: str) -> str:
    return get_payment_wallets().get(currency.upper(), "")

def _approx_equal(value: float, target: float, tolerance: float = 0.02) -> bool:
    return abs(value - target) <= tolerance

def _check_btc_payment(txid: str, amount: float) -> tuple[str, str]:
    import requests
    target_address = get_payment_wallet("BTC")
    if not target_address:
        return "pending_review", "Wallet BTC non configurato sul server"
    res = requests.get(f"https://blockstream.info/api/tx/{txid}", timeout=8)
    if res.status_code != 200:
        return "not_found", "TX Bitcoin non trovata"
    data = res.json()
    outputs = data.get("vout", [])
    for out in outputs:
        scriptpubkey_address = out.get("scriptpubkey_address")
        value_btc = float(out.get("value", 0)) / 100_000_000
        if scriptpubkey_address == target_address:
            if _approx_equal(value_btc, amount):
                return "matched", f"TX Bitcoin trovata: {value_btc:.8f} BTC verso wallet Aureo"
            return "amount_mismatch", f"TX trovata verso wallet Aureo ma importo {value_btc:.8f} BTC non coincide"
    return "address_mismatch", "TX Bitcoin trovata ma non verso il wallet Aureo"

def _check_eth_family_payment(txid: str, amount: float, currency: str) -> tuple[str, str]:
    import requests
    target_address = get_payment_wallet(currency).lower()
    if not target_address:
        return "pending_review", f"Wallet {currency} non configurato sul server"
    res = requests.get(f"https://eth.blockscout.com/api/v2/transactions/{txid}", timeout=8)
    if res.status_code != 200:
        return "not_found", f"TX {currency} non trovata"
    data = res.json()

    if currency == "ETH":
        to_hash = ((data.get("to") or {}).get("hash") or "").lower()
        value_wei = data.get("value")
        if to_hash != target_address:
            return "address_mismatch", "TX Ethereum trovata ma non verso il wallet Aureo"
        if value_wei is None:
            return "pending_review", "TX Ethereum trovata, importo non leggibile automaticamente"
        value_eth = float(value_wei) / 1e18
        if _approx_equal(value_eth, amount):
            return "matched", f"TX Ethereum trovata: {value_eth:.6f} ETH verso wallet Aureo"
        return "amount_mismatch", f"TX Ethereum trovata verso wallet Aureo ma importo {value_eth:.6f} ETH non coincide"

    transfers = data.get("token_transfers") or []
    for transfer in transfers:
        token_symbol = (transfer.get("token") or {}).get("symbol", "").upper()
        to_hash = ((transfer.get("to") or {}).get("hash") or "").lower()
        raw_value = transfer.get("total") or transfer.get("amount")
        decimals = int(((transfer.get("token") or {}).get("decimals")) or 6)
        if token_symbol == currency and to_hash == target_address and raw_value is not None:
            amount_value = float(raw_value) / (10 ** decimals)
            if _approx_equal(amount_value, amount):
                return "matched", f"TX {currency} trovata: {amount_value:.2f} {currency} verso wallet Aureo"
            return "amount_mismatch", f"TX {currency} trovata verso wallet Aureo ma importo {amount_value:.2f} {currency} non coincide"
    return "address_mismatch", f"TX {currency} trovata ma non verso il wallet/token atteso"

def _check_sol_payment(txid: str, amount: float) -> tuple[str, str]:
    import requests
    target_address = get_payment_wallet("SOL")
    if not target_address:
        return "pending_review", "Wallet SOL non configurato sul server"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTransaction",
        "params": [txid, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
    }
    res = requests.post("https://api.mainnet-beta.solana.com", json=payload, timeout=8)
    if res.status_code != 200:
        return "not_found", "TX Solana non trovata"
    data = res.json().get("result")
    if not data:
        return "not_found", "TX Solana non trovata"
    balances_before = data.get("meta", {}).get("preBalances") or []
    balances_after = data.get("meta", {}).get("postBalances") or []
    account_keys = data.get("transaction", {}).get("message", {}).get("accountKeys") or []
    for idx, account in enumerate(account_keys):
        pubkey = account.get("pubkey") if isinstance(account, dict) else account
        if pubkey == target_address and idx < len(balances_before) and idx < len(balances_after):
            delta_sol = max(0.0, (balances_after[idx] - balances_before[idx]) / 1e9)
            if _approx_equal(delta_sol, amount):
                return "matched", f"TX Solana trovata: {delta_sol:.6f} SOL verso wallet Aureo"
            return "amount_mismatch", f"TX Solana trovata verso wallet Aureo ma importo {delta_sol:.6f} SOL non coincide"
    return "address_mismatch", "TX Solana trovata ma non verso il wallet Aureo"

def _check_tron_usdt_payment(txid: str, amount: float) -> tuple[str, str]:
    import requests
    target_address = get_payment_wallet("USDT")
    if not target_address:
        return "pending_review", "Wallet USDT non configurato sul server"
    res = requests.get(f"https://api.trongrid.io/v1/transactions/{txid}/events", timeout=8)
    if res.status_code != 200:
        return "not_found", "TX USDT TRC20 non trovata"
    items = res.json().get("data") or []
    for item in items:
        if item.get("event_name") != "Transfer":
            continue
        result = item.get("result") or {}
        to_address = result.get("to")
        raw_value = result.get("value")
        token_info = item.get("token_info") or {}
        token_symbol = (token_info.get("symbol") or "").upper()
        token_decimals = int(token_info.get("decimals") or 6)
        if token_symbol == "USDT" and to_address == target_address and raw_value is not None:
            value_amount = float(raw_value) / (10 ** token_decimals)
            if _approx_equal(value_amount, amount):
                return "matched", f"TX USDT trovata: {value_amount:.2f} USDT verso wallet Aureo"
            return "amount_mismatch", f"TX USDT trovata verso wallet Aureo ma importo {value_amount:.2f} USDT non coincide"
    return "address_mismatch", "TX USDT trovata ma non verso il wallet Aureo"

def run_payment_check(payment: dict) -> tuple[str, str]:
    currency = (payment.get("currency") or "").upper()
    txid = payment.get("txid") or ""
    amount = float(payment.get("amount") or 0)
    try:
        if currency == "BTC":
            return _check_btc_payment(txid, amount)
        if currency in {"ETH", "USDC"}:
            return _check_eth_family_payment(txid, amount, currency)
        if currency == "SOL":
            return _check_sol_payment(txid, amount)
        if currency == "USDT":
            return _check_tron_usdt_payment(txid, amount)
        return "pending_review", f"Verifica automatica non disponibile per {currency}"
    except Exception as exc:
        return "pending_review", f"Controllo automatico non conclusivo: {str(exc)}"

@app.get("/api/billing/wallets")
def get_crypto_payment_wallets(user: dict = Depends(require_user)):
    wallets = get_payment_wallets()
    return {
        "wallets": wallets,
        "configured": {currency: bool(address) for currency, address in wallets.items()},
    }

@app.post("/api/billing/submit-txid")
def submit_crypto_payment(req: SubmitTxidRequest, user: dict = Depends(require_user)):
    user_id = user["sub"]
    import uuid
    payment_id = str(uuid.uuid4())
    success = db.create_payment(payment_id, user_id, req.txid, req.amount, req.currency)
    if not success:
        raise HTTPException(status_code=400, detail="Questo Transaction Hash è già stato inviato.")
    return {"status": "success", "message": "Pagamento inviato! Sarà verificato a breve."}

class VerifyPaymentRequest(BaseModel):
    payment_id: str
    action: str 
    months: int = 1

class CheckPaymentRequest(BaseModel):
    payment_id: str

@app.post("/api/billing/check-payment")
def check_crypto_payment(req: CheckPaymentRequest, admin_token: str = Depends(require_admin)):
    payment = db.get_payment_by_id(req.payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")

    check_status, check_message = run_payment_check(payment)
    db.update_payment_check(req.payment_id, check_status, check_message)
    return {
        "status": "success",
        "check_status": check_status,
        "message": check_message,
    }

@app.post("/api/billing/verify-payment")
def verify_crypto_payment(req: VerifyPaymentRequest, admin_token: str = Depends(require_admin)):
    payment = db.get_payment_by_id(req.payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
        
    if req.action == "approve":
        db.update_payment_status(req.payment_id, "verified")
        return {"status": "success", "message": "Pagamento confermato. Ora puoi attivare manualmente il mese sull’utente."}
    else:
        db.update_payment_status(req.payment_id, "rejected")
        return {"status": "success", "message": "Pagamento rifiutato"}

class AdminUserActionRequest(BaseModel):
    user_id: str

class AdminUserExtendRequest(BaseModel):
    user_id: str
    months: int = 1

class AdminUserPlanRequest(BaseModel):
    user_id: str
    plan_id: str

@app.post("/api/saas/activate-user")
def admin_activate_user(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    plan = get_plan_for_user(user.get("plan_id"))
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = 'active' WHERE id = ?", (req.user_id,))
    
    # Imposta scadenza a 30 giorni da oggi
    from datetime import datetime, timedelta
    new_exp = datetime.utcnow() + timedelta(days=30)
    cursor.execute("UPDATE users SET subscription_expires_at = ? WHERE id = ?", (new_exp.strftime("%Y-%m-%d %H:%M:%S"), req.user_id))
    
    conn.commit()
    conn.close()
    append_billing_activity(f"Utente {user['email']} attivato sullo step {plan['name']}", "user_activated")
    return {"status": "success", "message": f"Utente attivato manualmente con step {plan['name']}."}

@app.post("/api/saas/extend-user")
def admin_extend_user(req: AdminUserExtendRequest, admin_token: str = Depends(require_admin)):
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    months = max(1, min(int(req.months or 1), 24))
    now = datetime.utcnow()
    current_exp = None
    raw_exp = user.get("subscription_expires_at")
    if raw_exp:
        try:
            current_exp = datetime.strptime(raw_exp, "%Y-%m-%d %H:%M:%S")
        except Exception:
            current_exp = None
    start_from = current_exp if current_exp and current_exp > now else now
    new_exp = start_from + timedelta(days=30 * months)

    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET status = 'active', subscription_expires_at = ? WHERE id = ?",
        (new_exp.strftime("%Y-%m-%d %H:%M:%S"), req.user_id)
    )
    conn.commit()
    conn.close()
    append_billing_activity(f"Abbonamento esteso di {months} mese/i per {user['email']}", "subscription_extended")
    return {
        "status": "success",
        "message": f"Abbonamento esteso di {months} mese/i. Nuova scadenza: {new_exp.strftime('%Y-%m-%d')}.",
    }

@app.post("/api/saas/update-user-plan")
def admin_update_user_plan(req: AdminUserPlanRequest, admin_token: str = Depends(require_admin)):
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    plan = get_plan_for_user(req.plan_id)
    db.update_user_plan(req.user_id, plan["id"])
    append_billing_activity(f"Step aggiornato a {plan['name']} per {user['email']}", "plan_updated")
    return {
        "status": "success",
        "message": f"Step utente aggiornato a {plan['name']}.",
        "plan_id": plan["id"],
        "plan_name": plan["name"],
    }

@app.post("/api/saas/delete-user")
def admin_delete_user(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (req.user_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Utente eliminato."}

@app.get("/api/billing/payments")
def list_crypto_payments(admin_token: str = Depends(require_admin)):
    return db.get_all_payments()

@app.get("/api/saas/overview")
def get_saas_overview_db(admin_token: str = Depends(require_admin)):
    users = db.get_all_users()
    payments = db.get_all_payments()
    plans = get_plan_catalog()
    
    # Calcolo metriche
    active_customers = len([u for u in users if u["status"] == "active"])
    mrr = round(sum(float((plans.get((u.get("plan_id") or "pro")) or plans.get("pro") or {}).get("price_monthly", 0) or 0) for u in users if u["status"] == "active"), 2)
    now = datetime.utcnow()
    expiring_soon = 0
    past_due = 0
    
    # Formattazione per il frontend
    customers = []
    for u in users:
        plan = get_plan_for_user(u.get("plan_id"))
        expiry_label = u.get("subscription_expires_at", "N/A")
        days_left = None
        if u.get("subscription_expires_at"):
          try:
              expiry_dt = datetime.strptime(u["subscription_expires_at"], "%Y-%m-%d %H:%M:%S")
              days_left = (expiry_dt - now).days
              if u["status"] == "active" and days_left < 0:
                  past_due += 1
              elif u["status"] == "active" and days_left <= 7:
                  expiring_soon += 1
          except Exception:
              days_left = None
        customers.append({
            "id": u["id"],
            "email": u["email"],
            "status": u["status"],
            "role": u["role"],
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "modules_enabled": plan.get("modules", []),
            "next_billing_at": expiry_label,
            "days_left": days_left,
            "monthly_amount": plan.get("price_monthly", 0),
            "created_at": u.get("created_at")
        })
        
    return {
        "mrr": mrr,
        "active_customers": active_customers,
        "metrics": {
            "monthly_recurring_revenue": mrr,
            "annual_run_rate": round(mrr * 12, 2),
            "active_customers": active_customers,
            "trialing_customers": len([u for u in users if u["status"] == "pending"]),
            "leads_count": 0,
            "collection_rate": round((active_customers / len(users)) * 100, 1) if users else 0,
            "expiring_soon": expiring_soon,
            "past_due": past_due,
        },
        "payment_queue": payments[:10],
        "activity_feed": load_billing_db().get("recent_activity", [])[:8],
        "recent_activity": payments[:10],
        "customers": customers,
        "plans": list(plans.values()),
        "settings": {"currency": "USDT"}
    }


# --- SERVING FRONTEND (React) in Produzione ---
# Questa sezione serve i file statici di React costruiti nella cartella 'dist'
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{catchall:path}")
    def serve_react_app(request: Request, catchall: str):
        # Evita conflitti con gli endpoint /api/
        if catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API not found")
            
        file_path = os.path.join(frontend_dist, catchall)
        if os.path.isfile(file_path):
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

# --- LIFECYCLE EVENT FOR AUTORESTART ON BOOT ---
@app.on_event("startup")
def startup_event():
    # Avvia i motori che erano attivi prima del riavvio/spegnimento
    try:
        if bot_state.modules.get("trading", False) and 'alpaca_engine' in globals() and alpaca_engine is not None:
            bot_state.is_running = True
            bot_state.add_log("Autostart: Avvio automatico Alpaca Engine...")
            global_executor.submit(alpaca_engine.loop)
    except Exception as e:
        print(f"Errore autostart trading: {e}")
        
    try:
        if (bot_state.modules.get("crypto_arb", False) or bot_state.modules.get("high_risk_crypto_arb", False)) and 'arb_engine' in globals() and arb_engine is not None:
            bot_state.add_log("Autostart: Avvio automatico DeFi Arbitrage Engine...")
            global_executor.submit(arb_engine.loop)
    except Exception as e:
        print(f"Errore autostart crypto_arb: {e}")
        
    try:
        if bot_state.modules.get("sports_arb", False) and 'sports_engine' in globals() and sports_engine is not None:
            bot_state.add_log("Autostart: Avvio automatico Sports Arbitrage Engine...")
            global_executor.submit(sports_engine.loop)
    except Exception as e:
        print(f"Errore autostart sports_arb: {e}")
        
    try:
        if bot_state.modules.get("ai_sports_sentiment", False) and 'sentiment_engine' in globals() and sentiment_engine is not None:
            bot_state.add_log("Autostart: Avvio automatico AI Sentiment Radar...")
            global_executor.submit(sentiment_engine.loop)
    except Exception as e:
        print(f"Errore autostart sentiment: {e}")
        
    try:
        if bot_state.modules.get("ai_content", False) and 'ai_engine' in globals() and ai_engine is not None:
            bot_state.add_log("Autostart: Avvio automatico AI Content Creator...")
            global_executor.submit(ai_engine.loop)
    except Exception as e:
        print(f"Errore autostart ai_content: {e}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
