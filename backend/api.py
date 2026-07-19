from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response, UploadFile, File, Form, Depends, status
from risk_manager import get_risk_manager, RiskLimits
from capital_manager import get_capital_manager
from dataclasses import asdict
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel
import alpaca_trade_api as tradeapi
import os
import secrets
import smtplib
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
from email.message import EmailMessage
from urllib.parse import quote_plus
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

APP_BASE_URL = (os.getenv("APP_BASE_URL") or os.getenv("PUBLIC_APP_URL") or "https://aureoos.it").rstrip("/")
EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = 90

def build_confirmation_url(token: str) -> str:
    return f"{APP_BASE_URL}/api/confirm-email?token={quote_plus(token)}"

def send_welcome_email(email: str, confirmation_token: str):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587") or "587")
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "Aureo OS").strip()

    if not smtp_host or not smtp_from:
        raise RuntimeError("SMTP non configurato")

    confirmation_url = build_confirmation_url(confirmation_token)
    subject = "Benvenuto in Aureo — conferma la tua email"
    text_body = f"""Ciao,

benvenuto in Aureo.

Per attivare davvero il tuo accesso, conferma prima la tua email:
{confirmation_url}

Una volta confermata, potrai entrare nella tua area e completare il setup.

Chiavi utili per partire:
- Alpaca (obbligatoria): https://alpaca.markets
- Groq (consigliata): https://console.groq.com
- Telegram BotFather (opzionale): https://t.me/BotFather
- Pushover (opzionale): https://pushover.net

Indicazioni rapide:
- Alpaca: genera API Key e Secret Key
- Groq: crea una nuova API key dalla console
- Telegram: crea il bot con BotFather e recupera Bot Token + Chat ID
- Pushover: crea account, app token e user key

Se hai ricevuto questa mail per errore, puoi ignorarla.

Aureo OS
"""
    html_body = f"""
    <html>
      <body style="margin:0;padding:0;background:#07111f;color:#e5eefc;font-family:Arial,sans-serif;">
        <div style="max-width:700px;margin:0 auto;padding:32px 20px;">
          <div style="background:#0b1626;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;">
            <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.24);color:#bfe6ff;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Aureo OS · Welcome</div>
            <h1 style="font-size:40px;line-height:1.05;margin:24px 0 16px;color:#f8fafc;">Benvenuto in Aureo</h1>
            <p style="font-size:18px;line-height:1.7;color:#b7c5d9;margin:0 0 20px;">
              Il tuo accesso è quasi pronto. Per completare l’attivazione, ti basta confermare questa email.
            </p>
            <a href="{confirmation_url}" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#08111b;text-decoration:none;font-weight:800;padding:16px 24px;border-radius:14px;font-size:16px;">
              Conferma email e attiva accesso
            </a>
            <p style="font-size:14px;line-height:1.7;color:#8ea2bd;margin:18px 0 0;">
              Dopo il click verrai riportato in Aureo e potrai accedere con le credenziali che hai appena creato.
            </p>

            <div style="margin-top:28px;padding:22px;border-radius:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);">
              <h2 style="margin:0 0 14px;font-size:20px;color:#f8fafc;">Tutorial rapido chiavi</h2>
              <div style="display:grid;gap:14px;">
                <div>
                  <div style="font-weight:800;color:#fcd34d;">1. Alpaca · Broker trading</div>
                  <div style="color:#b7c5d9;line-height:1.6;">Obbligatoria. Ti serve API Key + Secret Key per collegare il broker.</div>
                  <a href="https://alpaca.markets" style="color:#7dd3fc;">Apri Alpaca</a>
                </div>
                <div>
                  <div style="font-weight:800;color:#c084fc;">2. Groq · Layer AI</div>
                  <div style="color:#b7c5d9;line-height:1.6;">Consigliata. Crea una API key dalla console Groq.</div>
                  <a href="https://console.groq.com" style="color:#7dd3fc;">Apri Groq</a>
                </div>
                <div>
                  <div style="font-weight:800;color:#38bdf8;">3. Telegram · Alert esterni</div>
                  <div style="color:#b7c5d9;line-height:1.6;">Opzionale. Ti servono Bot Token e Chat ID.</div>
                  <a href="https://t.me/BotFather" style="color:#7dd3fc;">Apri BotFather</a>
                </div>
                <div>
                  <div style="font-weight:800;color:#22c55e;">4. Pushover · Alert push</div>
                  <div style="color:#b7c5d9;line-height:1.6;">Opzionale. Ti servono App Token e User Key.</div>
                  <a href="https://pushover.net" style="color:#7dd3fc;">Apri Pushover</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
    """

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{smtp_from_name} <{smtp_from}>"
    msg["To"] = email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.ehlo()
        if os.getenv("SMTP_USE_TLS", "true").lower() not in ("0", "false", "no"):
            server.starttls()
            server.ehlo()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.send_message(msg)

def send_telegram_message(message: str, user_id: str = "admin"):
    try:
        user_bot_state = get_user_bot_state(user_id)
        if getattr(user_bot_state, "telegram_alerts_enabled", True) is False:
            return
    except Exception:
        pass
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    keys = db.get_api_keys(user_id) or {}
    bot_token = keys.get("telegram_bot_token") or bot_token
    chat_id = keys.get("telegram_chat_id") or chat_id
    
    if not bot_token or not chat_id:
        print("Telegram non configurato in .env o Vault")
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

def send_pushover_message(message: str, user_id: str = "admin", title: str = "Aureo OS", priority: int = 0, sound: str = ""):
    try:
        user_bot_state = get_user_bot_state(user_id)
        if getattr(user_bot_state, "pushover_alerts_enabled", True) is False:
            return
    except Exception:
        pass
    app_token = os.getenv("PUSHOVER_APP_TOKEN", "")
    user_key = os.getenv("PUSHOVER_USER_KEY", "")

    keys = db.get_api_keys(user_id) or {}
    app_token = keys.get("pushover_app_token") or app_token
    user_key = keys.get("pushover_user_key") or user_key

    if not app_token or not user_key:
        print("Pushover non configurato in .env o Vault")
        return

    payload = {
        "token": app_token,
        "user": user_key,
        "message": message[:1024],
        "title": title[:250],
        "priority": max(-2, min(2, int(priority))),
    }
    if sound:
        payload["sound"] = sound

    try:
        res = requests.post("https://api.pushover.net/1/messages.json", data=payload, timeout=3)
        if res.status_code != 200:
            print(f"Errore da Pushover: {res.text}")
    except Exception as e:
        print(f"Errore invio Pushover: {e}")

def send_critical_alert(message: str, user_id: str = "admin", title: str = "Aureo OS Critical"):
    send_telegram_message(message, user_id=user_id)
    send_pushover_message(message, user_id=user_id, title=title, priority=1, sound="persistent")

def send_critical_alert_once(event_key: str, message: str, user_id: str = "admin", title: str = "Aureo OS Critical", cooldown_seconds: int = 900):
    now = time.time()
    cache_key = f"{user_id}:{event_key}"
    last_sent_at = CRITICAL_ALERT_CACHE.get(cache_key, 0.0)
    if now - last_sent_at < max(0, cooldown_seconds):
        return
    CRITICAL_ALERT_CACHE[cache_key] = now
    send_critical_alert(message, user_id=user_id, title=title)

# Importiamo il modello
from data_loader import fetch_historical_data

DB_FILE_PREFIX = "bot_db"
db_lock = threading.Lock()
SYMBOL_RANK_CACHE_TTL_SECONDS = 300
CRITICAL_ALERT_CACHE = {}
symbol_rank_cache = {"expires_at": 0.0, "max_symbols": 0, "result": ([], [])}

def get_db_file(user_id=None):
    if not user_id or user_id == "admin":
        return f"{DB_FILE_PREFIX}.json"
    return f"{DB_FILE_PREFIX}_{user_id}.json"

def load_db(user_id=None):
    with db_lock:
        file_path = get_db_file(user_id)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    if "modules" in data:
                        data["modules"].pop("high_risk_crypto_arb", None)
                        data["modules"].pop("crypto_arb", None)
                    return data
            except json.JSONDecodeError:
                print("⚠️ bot_db.json corrotto (forse per un riavvio forzato). Ricarico default.")
        return {
            "virtual_cash": 100.0,
            "logs": [],
            "aggressiveness": 55.0,
            "modules": {"trading": False, "sports_arb": False, "ai_content": False},
            "dynamic_atr_stop": True,
            "trailing_stop_base_pct": 2.5,
            "telegram_alerts_enabled": True,
            "pushover_alerts_enabled": True,
        }

def save_db(state_dict, user_id=None):
    with db_lock:
        file_path = get_db_file(user_id)
        with open(file_path, "w") as f:
            json.dump(state_dict, f, indent=4)

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

class RiskToggleRequest(BaseModel):
    enabled: bool

@app.post("/api/risk/enabled")
def set_risk_enabled(payload: RiskToggleRequest, _: str = Depends(require_admin)):
    """Attiva o disattiva il risk manager"""
    risk = get_risk_manager(initial_capital=bot_state.virtual_cash)
    risk.set_enabled(payload.enabled)
    return {"status": "ok", "risk": risk.get_status()}

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
    bot_state = get_user_bot_state("admin")
    runtime = build_runtime_health_snapshot(bot_state)
    risk = get_risk_manager(initial_capital=bot_state.virtual_cash).get_status()
    if runtime.get("auto_paused") or runtime.get("status") == "red" or not risk.get("can_trade", True):
        status_label = "degraded"
    elif runtime.get("status") == "yellow":
        status_label = "warning"
    else:
        status_label = "ok"
    return {
        "status": status_label,
        "timestamp": datetime.now().isoformat(),
        "runtime": runtime,
        "risk": {
            "status": risk.get("status"),
            "can_trade": risk.get("can_trade"),
            "reason": risk.get("reason"),
        }
    }

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

def build_runtime_health_snapshot(bot_state):
    health = dict(getattr(bot_state, "runtime_health", {}) or {})
    now_ts = time.time()

    def age_seconds(iso_value):
        if not iso_value:
            return None
        try:
            return max(0, int(now_ts - datetime.fromisoformat(iso_value).timestamp()))
        except Exception:
            return None

    health["heartbeat_age_sec"] = age_seconds(health.get("last_heartbeat_at"))
    health["last_bar_age_sec"] = age_seconds(health.get("last_bar_at"))
    health["last_sync_age_sec"] = age_seconds(health.get("last_sync_at"))
    health["is_trading_enabled"] = bool(bot_state.modules.get("trading"))

    if not health.get("is_trading_enabled"):
        health["status"] = health.get("status") or "green"
        health["summary"] = health.get("summary") or "Modulo trading fermo"
        return health

    if health.get("auto_paused"):
        health["status"] = "red"
        if not health.get("summary"):
            health["summary"] = "Auto-pause attivata per sicurezza"
        return health

    warnings = list(health.get("warnings", []) or [])
    if (health.get("last_bar_age_sec") or 0) > 900:
        warnings.insert(0, "Feed dati fermo da oltre 15 minuti")
    if int(health.get("sync_failures") or 0) >= 2:
        warnings.insert(0, f"Sync portfolio instabile ({health.get('sync_failures')} errori)")
    if int(health.get("reconnect_attempts") or 0) >= 3:
        warnings.insert(0, f"WebSocket in riconnessione ({health.get('reconnect_attempts')} tentativi)")

    health["warnings"] = warnings[:10]
    if warnings and health.get("status") == "green":
        health["status"] = "yellow"
        health["summary"] = health.get("summary") or warnings[0]
    elif not warnings and health.get("status") != "red":
        health["status"] = "green"
        health["summary"] = health.get("summary") or "Motore operativo stabile"
    return health

# Pool di ticker volatili molto scambiati, ideali per lo scanning
POOL_TICKERS = [
    "SOFI", "PLTR", "LCID", "F", "SNAP", "PFE", "T", "CCL", 
    "AAL", "BAC", "INTC", "WBD", "PARA", "HOOD", "RIVN", "NIO", 
    "LYFT", "PINS", "CHWY", "DKNG", "AMC", "GME",
    # Aggiunte Crypto
    "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"
]

# Aggiunti ETF BRICS (Brazil, China, India, South Africa) e Crypto Base + Meme
DEFAULT_TARGET_SYMBOLS = ["TSLA", "NVDA", "PLTR", "SOFI", "MARA", "AMD", "AAPL", "EWZ", "FXI", "INDA", "EZA", "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "SHIB/USD", "LINK/USD"]
PREFERRED_CRYPTO_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"]
MIN_CRYPTO_WATCHLIST = 3
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
    min_crypto = min(MIN_CRYPTO_WATCHLIST, max_symbols)
    stock_slots = max(0, max_symbols - min_crypto)

    selected_symbols, ranked_rows = rank_stock_universe(max_symbols=stock_slots)

    crypto_symbols = PREFERRED_CRYPTO_SYMBOLS[:min_crypto]
    crypto_rows = [
        {
            "symbol": symbol,
            "price": None,
            "score": None,
            "selection_reason": "Crypto core mantenuta sempre attiva in watchlist",
        }
        for symbol in crypto_symbols
    ]

    combined_symbols = list(dict.fromkeys((selected_symbols or []) + crypto_symbols))
    combined_ranked_rows = ranked_rows + crypto_rows

    if not combined_symbols:
        combined_symbols = DEFAULT_TARGET_SYMBOLS[:max_symbols]

    bot_state.target_symbols = combined_symbols[:max_symbols]
    bot_state.symbol_selection = {
        "updated_at": datetime.now().isoformat(),
        "method": "momentum_liquidity_volatility_plus_crypto_core",
        "ranked": combined_ranked_rows[:max_symbols],
    }
    bot_state.save_state()
    return bot_state.target_symbols

def get_yf_symbol(symbol):
    """Converte simboli Alpaca in simboli Yahoo Finance."""
    return symbol.replace("/", "-")

target_symbols = [] # Inizialmente vuoto, verrà popolato dinamicamente

class BotState:
    def __init__(self, user_id=None):
        self.user_id = user_id
        db_data = load_db(user_id)
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
        self.arb_logs = []
        self.arb_prices = {"binance": 0, "kraken": 0}
        self.monitored_positions = []  # [{symbol, buy_price, qty, amount, peak_price, target_price, price_history, timestamp}]
        self.reentry_watchlist = []   # [{symbol, exit_price, original_amount, reentry_count, trigger_pct, added_at}]
        self.loop_task = None
        self.aggressiveness = db_data.get("aggressiveness", 55.0)
        self.auto_bet_enabled = db_data.get("auto_bet_enabled", False)
        self.auto_bet_threshold = db_data.get("auto_bet_threshold", 10.0)
        self.symbol_selection = db_data.get("symbol_selection", {"method": "static_default", "ranked": []})
        self.dynamic_atr_stop = db_data.get("dynamic_atr_stop", True)
        self.trailing_stop_base_pct = db_data.get("trailing_stop_base_pct", 2.5)
        self.telegram_alerts_enabled = db_data.get("telegram_alerts_enabled", True)
        self.pushover_alerts_enabled = db_data.get("pushover_alerts_enabled", True)
        self.runtime_health = db_data.get("runtime_health", {
            "status": "green",
            "summary": "In attesa avvio modulo trading",
            "websocket_connected": False,
            "last_heartbeat_at": None,
            "last_bar_at": None,
            "last_sync_at": None,
            "last_error": None,
            "sync_failures": 0,
            "reconnect_attempts": 0,
            "auto_paused": False,
            "auto_pause_reason": None,
            "warnings": [],
        })
        default_modules = {
            "trading": False,
            "sports_arb": False,
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
        already_timestamped = isinstance(message, str) and len(message) >= 10 and message[0] == "[" and message[9] == "]"
        rendered_message = message if already_timestamped else f"[{timestamp}] {message}"
        self.logs.insert(0, rendered_message)
        if len(self.logs) > 50:
            self.logs = self.logs[:50]
        self.save_state()
        
        # Invia la notifica su Telegram
        send_telegram_message(rendered_message)

    def set_runtime_health(self, persist: bool = False, **kwargs):
        current = dict(getattr(self, "runtime_health", {}) or {})
        warnings = kwargs.pop("warnings", None)
        current.update(kwargs)
        if warnings is not None:
            current["warnings"] = list(warnings)[:10]
        self.runtime_health = current
        if persist:
            self.save_state()

    def add_runtime_warning(self, warning: str, persist: bool = False):
        current = dict(getattr(self, "runtime_health", {}) or {})
        warnings = list(current.get("warnings", []) or [])
        warnings.insert(0, warning)
        current["warnings"] = warnings[:10]
        self.runtime_health = current
        if persist:
            self.save_state()
        
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
            "dynamic_atr_stop": self.dynamic_atr_stop,
            "trailing_stop_base_pct": self.trailing_stop_base_pct,
            "telegram_alerts_enabled": self.telegram_alerts_enabled,
            "pushover_alerts_enabled": self.pushover_alerts_enabled,
            "runtime_health": self.runtime_health,
        }, self.user_id)

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
sports_engine = SportsArbitrage(bot_state)
sentiment_engine = None
ai_engine = AIContentCreator(bot_state)

engines = {
    "sports_arb": sports_engine,
    "ai_content": ai_engine
}
user_bot_states = {"admin": bot_state}
user_engines = {}
status_snapshot_cache = {}
status_snapshot_lock = threading.Lock()

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
trade_lock = threading.Lock()


def _get_status_snapshot_ttl(scope: str) -> float:
    if scope in {"trading", "charts"}:
        return 1.5
    if scope in {"sports_arb", "value_bets", "ai_content", "home"}:
        return 3.0
    return 5.0


def _get_cached_alpaca_snapshot(user_id: str, alpaca, target_symbols, current_capital: float, scope: str):
    if not alpaca:
        return {
            "alpaca_connected": False,
            "positions": {},
            "portfolio_value": current_capital,
            "market_open": False,
            "alpaca_info": {"status": "Scollegato", "account_number": "N/A", "type": "N/A"},
        }

    now_ts = time.time()
    ttl = _get_status_snapshot_ttl(scope)
    cache_key = f"{user_id}:{scope}"

    with status_snapshot_lock:
        cached = status_snapshot_cache.get(cache_key)
        if cached and cached["expires_at"] > now_ts and cached.get("target_symbols") == tuple(target_symbols):
            return cached["payload"]

    positions_dict = {}
    pos_unrealized_pl = 0.0
    market_open = False
    alpaca_info = {"status": "Scollegato", "account_number": "N/A", "type": "N/A"}

    try:
        account = alpaca.get_account()
        positions = alpaca.list_positions()

        for position in positions:
            if position.symbol in target_symbols:
                positions_dict[position.symbol] = {
                    "qty": float(position.qty),
                    "market_value": float(position.market_value),
                    "side": position.side.upper(),
                    "unrealized_pl": float(getattr(position, 'unrealized_pl', 0)),
                    "unrealized_plpc": float(getattr(position, 'unrealized_plpc', 0)) * 100
                }
                pos_unrealized_pl += float(getattr(position, 'unrealized_pl', 0))

        try:
            clock = alpaca.get_clock()
            market_open = clock.is_open
        except Exception:
            market_open = False

        alpaca_info["account_number"] = account.account_number
        alpaca_info["status"] = account.status
        is_paper = "paper" in os.getenv("ALPACA_BASE_URL", "").lower()
        alpaca_info["type"] = "PAPER" if is_paper else "LIVE"
    except Exception:
        pass

    payload = {
        "alpaca_connected": True,
        "positions": positions_dict,
        "portfolio_value": current_capital + pos_unrealized_pl,
        "market_open": market_open,
        "alpaca_info": alpaca_info,
    }

    with status_snapshot_lock:
        status_snapshot_cache[cache_key] = {
            "expires_at": now_ts + ttl,
            "target_symbols": tuple(target_symbols),
            "payload": payload,
        }

    return payload


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
def get_status(user_id="admin", scope: str = "core"):
    bot_state = get_user_bot_state(user_id)
    alpaca = get_user_alpaca_engine(user_id).alpaca_rest
    pos_dict = {}
    virtual_portfolio_value = get_capital_manager().config.current_capital
    try:
        cap = get_capital_manager()
        current_capital = cap.config.current_capital
        snapshot = _get_cached_alpaca_snapshot(
            user_id=user_id,
            alpaca=alpaca,
            target_symbols=bot_state.target_symbols,
            current_capital=current_capital,
            scope=scope,
        )
        alpaca_connected = snapshot["alpaca_connected"]
        pos_dict = dict(snapshot["positions"])
        virtual_portfolio_value = snapshot["portfolio_value"]

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

        market_open = snapshot["market_open"]
        alpaca_info = snapshot["alpaca_info"]

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

        response = {
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
            "last_trade": bot_state.last_trade,
            "cash": round(bot_state.virtual_cash, 2),
            "symbols": bot_state.target_symbols,
            "alpaca_connected": alpaca_connected,
            "alpaca_info": alpaca_info,
            "aggressiveness": bot_state.aggressiveness,
            "modules": bot_state.modules,
            "auto_bet_enabled": bot_state.auto_bet_enabled,
            "auto_bet_threshold": bot_state.auto_bet_threshold,
            "dynamic_atr_stop": getattr(bot_state, "dynamic_atr_stop", True),
            "trailing_stop_base_pct": getattr(bot_state, "trailing_stop_base_pct", 2.5),
            "runtime_health": build_runtime_health_snapshot(bot_state),
            "risk": get_risk_manager(initial_capital=bot_state.virtual_cash).get_status(),
        }
        if scope in {"trading", "charts", "full"}:
            response.update({
                "predictions": bot_state.latest_predictions,
                "symbol_selection": getattr(bot_state, "symbol_selection", {}),
                "logs": bot_state.logs[:80],
                "trade_history": bot_state.trade_history[-120:],
                "monitored_positions": getattr(bot_state, "monitored_positions", []),
                "reentry_watchlist": getattr(bot_state, "reentry_watchlist", []),
                "ai_investments": getattr(bot_state, "ai_investments", []),
            })
        if scope in {"sports_arb", "full"}:
            response.update({
                "sports_logs": getattr(bot_state, "sports_logs", [])[:120],
                "active_surebets": getattr(bot_state, "active_surebets", []),
            })
        if scope in {"value_bets", "full"}:
            response.update({
                "value_bets": getattr(bot_state, "value_bets", []),
            })
        if scope in {"home", "ai_content", "full"}:
            response.update({
                "ai_videos": getattr(bot_state, "ai_videos", []),
            })
        if scope in {"ai_content", "full"}:
            response.update({
                "ai_logs": getattr(bot_state, "ai_logs", [])[:120],
            })
        return response
    except Exception as e:
        return {"error": str(e)}


import math
def sanitize_nans(obj):
    if type(obj).__module__ == 'numpy':
        try:
            obj = obj.item()
        except:
            pass
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nans(v) for v in obj]
    return obj

@app.get("/api/status")
def api_status(response: Response, request: Request):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    user_id = "admin"
    auth = request.headers.get("Authorization")
    scope = request.query_params.get("scope", "core")
    if auth and auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub", "admin")
        except: pass
    try:
        raw_status = get_status(user_id, scope=scope)
        return sanitize_nans(raw_status)
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/modules")
async def toggle_module(payload: dict, user: dict = Depends(require_user)):
    mod_id = payload.get("module")
    active = payload.get("active")
    
    user_id = user.get("sub", "admin")
    u_bot_state = get_user_bot_state(user_id)
    u_alpaca_engine = get_user_alpaca_engine(user_id)
    u_sports_engine = sports_engine
    u_ai_engine = ai_engine
    
    # Sentiment Engine (global or specific, let's assume it exists globally as fallback)
    u_sentiment_engine = sentiment_engine
    
    if mod_id in u_bot_state.modules:
        u_bot_state.modules[mod_id] = active
        u_bot_state.save_state()
        state_str = "ATTIVATO" if active else "DISATTIVATO"
        u_bot_state.add_log(f"⚙️ Modulo {mod_id.upper()} {state_str}")
        
        # Start/Stop logic
        module_name = mod_id
        if active:
            if module_name == "ai_content" and u_ai_engine and not getattr(u_ai_engine, "running", False):
                u_ai_engine.running = True
                u_ai_engine.user_id = user_id
                global_executor.submit(u_ai_engine.loop)
            elif module_name == "sports_arb" and u_sports_engine and not getattr(u_sports_engine, "running", False):
                u_sports_engine.bot_state = u_bot_state
                u_sports_engine.running = True
                u_sports_engine.user_id = user_id
                global_executor.submit(u_sports_engine.loop)
                u_bot_state.add_log("⚽ Modulo Sports Arbitrage avviato.")
            elif module_name == "ai_sports_sentiment":
                if u_sentiment_engine is None:
                    u_bot_state.modules[mod_id] = False
                    u_bot_state.save_state()
                    return {"error": "Modulo AI Sentiment Radar non disponibile in questa build"}
                if not getattr(u_sentiment_engine, "running", False):
                    u_sentiment_engine.bot_state = u_bot_state
                    u_sentiment_engine.running = True
                    u_sentiment_engine.user_id = user_id
                    global_executor.submit(u_sentiment_engine.loop)
                    u_bot_state.add_log("📡 Modulo AI Sentiment Radar avviato.")
            elif module_name == "trading":
                u_bot_state.is_running = True
                if u_alpaca_engine and not getattr(u_alpaca_engine, "running", False):
                    u_alpaca_engine.running = True
                    u_alpaca_engine.user_id = user_id
                    global_executor.submit(u_alpaca_engine.loop)
        else:
            if module_name == "sports_arb" and u_sports_engine:
                if hasattr(u_sports_engine, "stop"): u_sports_engine.stop()
                u_bot_state.add_log("⚽ Modulo Sports Arbitrage fermato.")
            elif module_name == "ai_sports_sentiment" and u_sentiment_engine:
                if hasattr(u_sentiment_engine, "stop"): u_sentiment_engine.stop()
                u_bot_state.add_log("📡 Modulo AI Sentiment Radar fermato.")
            elif module_name == "trading":
                u_bot_state.is_running = False
                if u_alpaca_engine:
                    u_alpaca_engine.running = False
                    if hasattr(u_alpaca_engine, "alpaca_stream") and getattr(u_alpaca_engine, "alpaca_stream", None):
                        try:
                            u_alpaca_engine.alpaca_stream.stop()
                        except: pass
                
        current_state = get_status(user_id)
        return {
            "message": "Modulo aggiornato", 
            "modules": u_bot_state.modules, 
            "status": current_state
        }
    return {"error": "Modulo non trovato"}
@app.get("/api/stock/quote/{symbol}")
def get_stock_quote(symbol: str, user_id: str = "admin"):
    """Restituisce la quotazione in tempo reale tramite Alpaca (o yfinance come fallback)."""
    symbol = symbol.upper().strip()
    try:
        alpaca = get_user_alpaca_engine(user_id).alpaca_rest
        if alpaca:
            try:
                trade = alpaca.get_latest_trade(symbol)
                if trade and getattr(trade, "price", None):
                    return {"symbol": symbol, "price": float(trade.price)}
            except Exception:
                pass

            try:
                latest_bar = alpaca.get_latest_bar(symbol)
                if latest_bar and getattr(latest_bar, "c", None):
                    return {"symbol": symbol, "price": float(latest_bar.c)}
            except Exception:
                pass

            try:
                bars = alpaca.get_bars(symbol, tradeapi.TimeFrame.Day, limit=2).df
                if not bars.empty:
                    close_col = "close" if "close" in bars.columns else "Close"
                    last_price = bars[close_col].dropna().iloc[-1]
                    return {"symbol": symbol, "price": float(last_price)}
            except Exception:
                pass
    except Exception as e:
        pass
        
    # Fallback su yfinance
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        try:
            fast_info = getattr(ticker, "fast_info", None)
            if fast_info:
                for key in ("lastPrice", "regularMarketPrice", "previousClose"):
                    value = fast_info.get(key) if hasattr(fast_info, "get") else None
                    if value:
                        return {"symbol": symbol, "price": float(value)}
        except Exception:
            pass

        for period in ("1d", "5d", "1mo"):
            data = ticker.history(period=period, interval="1d", prepost=True)
            if not data.empty:
                close_col = "Close" if "Close" in data.columns else data.columns[-1]
                price = data[close_col].dropna().iloc[-1]
                return {"symbol": symbol, "price": float(price)}
    except Exception as e:
        pass
        
    return {"error": f"Impossibile recuperare la quotazione per {symbol}"}

@app.post("/api/stock/trade/manual")
def manual_stock_trade(payload: dict, req: Request, _: str = Depends(require_admin)):
    user_id = "admin"
    auth = req.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            tok = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = tok.get("sub", "admin")
        except: pass
    """Esegue un trade azionario manuale e lo invia ad Alpaca."""
    symbol = payload.get("symbol", "").upper().strip()
    side = payload.get("side", "buy").lower()
    amount = float(payload.get("amount", 0))
    
    if not symbol or side not in ["buy", "sell"] or amount <= 0:
        return {"error": "Parametri non validi"}
        
    u_state = get_user_bot_state(user_id)
    alpaca_engine = get_user_alpaca_engine(user_id)
        
    # Ottieni prezzo
    quote = get_stock_quote(symbol, user_id)
    if "error" in quote:
        return quote
        
    price = quote["price"]
    qty = amount / price
    qty = round(qty, 4)
    
    # Se la quantità è frazionaria, Alpaca non supporta ordini avanzati.
    # Invia un ordine Market Semplice ad Alpaca se configurato
    if alpaca_engine and alpaca_engine.alpaca_rest:
        try:
            alpaca_engine.alpaca_rest.submit_order(
                symbol=symbol,
                qty=qty,
                side=side,
                type='market',
                time_in_force='day'
            )
        except Exception as e:
            return {"error": f"Alpaca ha rifiutato l'ordine: {str(e)}"}
    
    # Esegui in Paper Mode (virtual_cash) locale
    if side == "buy":
        if u_state.virtual_cash < amount:
            return {"error": "Fondi virtuali insufficienti"}
        u_state.virtual_cash -= amount
        
        # Aggiungi a monitored positions se l'utente vuole che il bot gestisca l'uscita
        u_state.monitored_positions.append({
            "symbol": symbol,
            "buy_price": price,
            "qty": qty,
            "amount": amount,
            "peak_price": price,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
        
        _send_telegram_trade(
            event="BUY", symbol=symbol, qty=qty, price=price,
            reason="Trade Azionario Manuale", virtual_cash=u_state.virtual_cash
        )
        u_state.save_state()
        return {"status": "ok", "message": f"Acquistate {qty:.4f} {symbol} a ${price:.2f}"}
    else:
        # SELL manuale
        # Trova la posizione in monitored_positions
        pos_idx = -1
        for i, p in enumerate(u_state.monitored_positions):
            if p["symbol"].upper() == symbol:
                pos_idx = i
                break
                
        if pos_idx == -1:
            return {"error": f"Nessuna posizione aperta trovata in locale per {symbol}"}
            
        pos = u_state.monitored_positions.pop(pos_idx)
        revenue = pos["qty"] * price
        profit = revenue - pos["amount"]
        
        u_state.virtual_cash += revenue
        u_state.profit += profit
        u_state.save_state()
        
        _send_telegram_trade(
            event="SELL", symbol=symbol, qty=pos["qty"], price=price,
            reason=f"Chiusura Manuale Azionario", virtual_cash=u_state.virtual_cash
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
async def update_auto_bet_settings(payload: dict, user: dict = Depends(require_user)):
    """Aggiorna le impostazioni dell'auto-bet (abilitato + soglia %)"""
    try:
        user_id = user.get("sub", "admin")
        u_bot_state = get_user_bot_state(user_id)
        changed = False
        if "enabled" in payload:
            u_bot_state.auto_bet_enabled = bool(payload["enabled"])
            changed = True
            state = "ABILITATO" if u_bot_state.auto_bet_enabled else "DISABILITATO"
            thresh = float(getattr(u_bot_state, "auto_bet_threshold", 10.0))
            u_bot_state.add_log(f"🤖 Auto-Bet {state} (soglia: {thresh:.1f}%)")
        
        if "threshold" in payload:
            val = float(payload["threshold"])
            u_bot_state.auto_bet_threshold = max(1.0, min(val, 50.0))  # clamp 1-50%
            changed = True
            thresh = float(u_bot_state.auto_bet_threshold)
            u_bot_state.add_log(f"🤖 Auto-Bet soglia aggiornata a {thresh:.1f}%")
            
        if changed:
            u_bot_state.save_state()
            
        return {
            "status": "ok",
            "auto_bet_enabled": getattr(u_bot_state, "auto_bet_enabled", False),
            "auto_bet_threshold": getattr(u_bot_state, "auto_bet_threshold", 10.0)
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
async def update_config(config: dict, user: dict = Depends(require_user)):
    user_id = user.get("sub", "admin")
    u_state = get_user_bot_state(user_id)
    if "aggressiveness" in config:
        u_state.aggressiveness = float(config["aggressiveness"])
        u_state.save_state()
        u_state.add_log(f"Aggressività IA impostata al {u_state.aggressiveness}%")
        return {"message": "Configurazione aggiornata", "aggressiveness": u_state.aggressiveness}
    if config.get("refresh_symbols"):
        symbol_count = int(config.get("symbol_count", 7))
        symbol_count = max(3, min(symbol_count, 12))
        selected = refresh_target_symbols(max_symbols=symbol_count)
        u_state.add_log(f"🎯 Nuova selezione titoli: {', '.join(selected)}")
        return {
            "message": "Watchlist aggiornata",
            "symbols": selected,
            "symbol_selection": u_state.symbol_selection,
        }
    return {"error": "Parametri non validi"}

@app.post("/api/stop")
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
        
        # Reset del Risk Manager
        try:
            from risk_manager import get_risk_manager
            import risk_manager as rm
            risk_file = os.path.join(os.path.dirname(__file__), "risk_state.json")
            if os.path.exists(risk_file):
                os.remove(risk_file)
            rm._risk_manager_instance = None
            get_risk_manager(bot_state.virtual_cash)
            bot_state.add_log("🔄 Risk Manager resettato (Circuit Breaker sbloccato).")
        except Exception as e:
            print(f"Errore reset risk manager: {e}")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore Reset: {str(e)}")
        
    return {"message": "Simulazione resettata", "state": get_status()}

@app.get("/api/chart-data/{symbol:path}")
def get_chart_data(symbol: str, timeframe: str = "1M"):
    try:
        sym = get_yf_symbol(symbol)

        def get_time_format_for_interval(current_interval: str) -> str:
            if current_interval == "5m":
                return "%H:%M"
            if current_interval == "15m":
                return "%d/%m %H:%M"
            if current_interval == "1h":
                return "%d/%m"
            if current_interval == "1d":
                return "%b '%y"
            if current_interval == "1wk":
                return "%Y"
            return "%d/%m"

        def build_synthetic_chart_data(last_price: float, selected_timeframe: str):
            from datetime import timedelta

            now = datetime.now()
            if selected_timeframe == "1D":
                points = 24
                step = timedelta(minutes=15)
                label_format = "%H:%M"
            elif selected_timeframe == "1W":
                points = 28
                step = timedelta(hours=6)
                label_format = "%d/%m %H:%M"
            elif selected_timeframe == "1Y":
                points = 24
                step = timedelta(days=15)
                label_format = "%b '%y"
            elif selected_timeframe == "ALL":
                points = 20
                step = timedelta(days=30)
                label_format = "%Y"
            else:
                points = 30
                step = timedelta(days=1)
                label_format = "%d/%m"

            synthetic = []
            base_price = max(float(last_price), 0.01)
            for idx in range(points):
                ratio = idx / max(points - 1, 1)
                wave = math.sin(idx / 2.7) * base_price * 0.0035
                drift = (ratio - 0.5) * base_price * 0.006
                price = round(base_price + wave + drift, 2)
                timestamp = now - step * (points - idx - 1)
                synthetic.append({
                    "time": timestamp.strftime(label_format),
                    "price": max(price, 0.01),
                })
            return synthetic

        def resolve_reference_price(raw_symbol: str):
            cleaned_symbol = raw_symbol.upper().strip()
            try:
                alpaca = get_user_alpaca_engine("admin").alpaca_rest
                if alpaca:
                    try:
                        trade = alpaca.get_latest_trade(cleaned_symbol)
                        if trade and getattr(trade, "price", None):
                            return float(trade.price)
                    except Exception:
                        pass

                    try:
                        latest_bar = alpaca.get_latest_bar(cleaned_symbol)
                        if latest_bar and getattr(latest_bar, "c", None):
                            return float(latest_bar.c)
                    except Exception:
                        pass

                    try:
                        latest_daily_bars = alpaca.get_bars(cleaned_symbol, tradeapi.TimeFrame.Day, limit=2).df
                        if not latest_daily_bars.empty:
                            close_col = "close" if "close" in latest_daily_bars.columns else "Close"
                            close_series = latest_daily_bars[close_col].dropna()
                            if not close_series.empty:
                                return float(close_series.iloc[-1])
                    except Exception:
                        pass
            except Exception:
                pass

            try:
                import yfinance as yf
                ticker = yf.Ticker(cleaned_symbol)

                try:
                    fast_info = getattr(ticker, "fast_info", None)
                    if fast_info:
                        for key in ("lastPrice", "regularMarketPrice", "previousClose"):
                            value = fast_info.get(key) if hasattr(fast_info, "get") else None
                            if value:
                                return float(value)
                except Exception:
                    pass

                for quote_period in ("1d", "5d", "1mo"):
                    quote_df = ticker.history(period=quote_period, interval="1d", prepost=True)
                    if not quote_df.empty:
                        close_col = "Close" if "Close" in quote_df.columns else quote_df.columns[-1]
                        close_series = quote_df[close_col].dropna()
                        if not close_series.empty:
                            return float(close_series.iloc[-1])
            except Exception:
                pass

            return None

        if timeframe == "1D":
            period = "1d"
            interval = "5m"
            fallback_queries = [("5d", "15m"), ("1mo", "1h")]
        elif timeframe == "1W":
            period = "5d"
            interval = "15m"
            fallback_queries = [("1mo", "1h"), ("3mo", "1d")]
        elif timeframe == "1M":
            period = "1mo"
            interval = "1h"
            fallback_queries = [("3mo", "1d"), ("6mo", "1d")]
        elif timeframe == "1Y":
            period = "1y"
            interval = "1d"
            fallback_queries = [("2y", "1d"), ("5y", "1wk")]
        elif timeframe == "ALL":
            period = "max"
            interval = "1wk"
            fallback_queries = [("5y", "1wk"), ("2y", "1d")]
        else:
            period = "1mo"
            interval = "1h"
            fallback_queries = [("3mo", "1d")]
        time_format = get_time_format_for_interval(interval)

        try:
            import yfinance as yf
            ticker = yf.Ticker(sym)
            df = ticker.history(interval=interval, period=period, prepost=True)
            if df.empty:
                for fallback_period, fallback_interval in fallback_queries:
                    df = ticker.history(interval=fallback_interval, period=fallback_period, prepost=True)
                    if not df.empty:
                        interval = fallback_interval
                        period = fallback_period
                        time_format = get_time_format_for_interval(interval)
                        break
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
                elif get_user_alpaca_engine("admin").alpaca_rest:
                    alpaca = get_user_alpaca_engine("admin").alpaca_rest
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
            try:
                quote_payload = get_stock_quote(symbol, "admin")
                if isinstance(quote_payload, dict) and quote_payload.get("price"):
                    print(f"[chart-data] route fallback for {symbol} @ {quote_payload['price']}")
                    return build_synthetic_chart_data(float(quote_payload["price"]), timeframe)
            except Exception:
                pass

            reference_price = resolve_reference_price(symbol)
            if reference_price:
                print(f"[chart-data] synthetic fallback for {symbol} @ {reference_price}")
                return build_synthetic_chart_data(reference_price, timeframe)

            print(f"[chart-data] emergency fallback for {symbol} @ 100.0")
            return build_synthetic_chart_data(100.0, timeframe)
        
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
            "id": "week_pass",
            "name": "Aureo Access Week",
            "price_monthly": 25,
            "price_label": "€25",
            "cadence_label": "/prima settimana",
            "currency": "EUR",
            "description": "Sette giorni di accesso pieno per provare Aureo nella sua forma completa.",
            "features": ["Accesso completo a tutti i moduli", "Esperienza premium riservata", "Alert e controllo inclusi", "Attivazione guidata"],
            "modules": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_WEEK_URL", "https://buy.stripe.com/test_week"),
        },
        {
            "id": "monthly",
            "name": "Aureo Monthly",
            "price_monthly": 120,
            "price_label": "€120",
            "cadence_label": "/mese",
            "currency": "EUR",
            "description": "L’abbonamento mensile pensato per chi usa Aureo con regolarità.",
            "features": ["Accesso completo continuativo", "Tutti i moduli Aureo inclusi", "Supporto operativo", "Esperienza multi-device"],
            "modules": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_MONTHLY_URL", "https://buy.stripe.com/test_monthly"),
        },
        {
            "id": "annual",
            "name": "Aureo Annual",
            "price_monthly": 1000,
            "price_label": "€1000",
            "cadence_label": "/anno",
            "monthly_equivalent": 83.33,
            "currency": "EUR",
            "description": "La formula annuale per chi vuole la massima continuità con il miglior rapporto valore/accesso.",
            "features": ["Accesso completo per 12 mesi", "Costo medio mensile ridotto", "Tutti i moduli inclusi", "Priorità sul rinnovo"],
            "modules": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
            "checkout_url": os.getenv("STRIPE_CHECKOUT_ANNUAL_URL", "https://buy.stripe.com/test_annual"),
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
                "plan_id": "monthly",
                "status": "active",
                "seats": 3,
                "monthly_amount": 120,
                "started_at": "2026-06-12",
                "next_billing_at": "2026-08-12",
                "modules_enabled": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
                "source": "direct",
            },
            {
                "id": "cus_demo_beta",
                "company": "Beta Capital Lab",
                "contact_name": "Giulia Bianchi",
                "email": "giulia@betacapitallab.com",
                "plan_id": "annual",
                "status": "active",
                "seats": 1,
                "monthly_amount": 83.33,
                "started_at": "2026-07-01",
                "next_billing_at": "2027-07-08",
                "modules_enabled": ["dashboard", "trading", "defi", "sentiment", "ai_content", "billing"],
                "source": "demo",
            },
        ],
        "leads": [
            {
                "id": "lead_demo_1",
                "company": "Omega Signals",
                "contact_name": "Luca Verdi",
                "email": "luca@omegasignals.io",
                "plan_id": "week_pass",
                "status": "lead",
                "created_at": "2026-07-02",
                "source": "website",
            }
        ],
        "recent_activity": [
            {"id": "act_1", "type": "trial_started", "label": "Omega Signals ha richiesto i 7 giorni Full Access", "created_at": "2026-07-01 10:20"},
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

class LoginRequest(BaseModel):
    email: Optional[str] = None
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class EmailRequest(BaseModel):
    email: str


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
SIGNUP_MAX_ATTEMPTS = int(os.getenv("SIGNUP_MAX_ATTEMPTS", "4"))
SIGNUP_WINDOW_SECONDS = int(os.getenv("SIGNUP_WINDOW_SECONDS", "3600"))
_signup_attempts = {}
_email_domain_cache = {}

try:
    _res = requests.get("https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf", timeout=5)
    if _res.status_code == 200:
        DISPOSABLE_DOMAINS = set(line.strip().lower() for line in _res.text.splitlines() if line.strip() and not line.startswith("//"))
        print(f"Loaded {len(DISPOSABLE_DOMAINS)} disposable email domains.")
except Exception as e:
    print(f"Failed to load disposable domains: {e}")

def _prune_signup_attempts() -> None:
    now = time.time()
    expired = []
    for key, attempt_times in _signup_attempts.items():
        valid_attempts = [ts for ts in attempt_times if now - ts < SIGNUP_WINDOW_SECONDS]
        if valid_attempts:
            _signup_attempts[key] = valid_attempts
        else:
            expired.append(key)
    for key in expired:
        _signup_attempts.pop(key, None)

def assert_signup_allowed(client_id: str) -> None:
    _prune_signup_attempts()
    attempt_times = _signup_attempts.get(client_id, [])
    if len(attempt_times) >= SIGNUP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Troppe richieste di registrazione da questa origine. Riprova più tardi.",
        )

def record_signup_attempt(client_id: str) -> None:
    now = time.time()
    attempt_times = [ts for ts in _signup_attempts.get(client_id, []) if now - ts < SIGNUP_WINDOW_SECONDS]
    attempt_times.append(now)
    _signup_attempts[client_id] = attempt_times

def clear_signup_attempts(client_id: str) -> None:
    _signup_attempts.pop(client_id, None)

def _domain_accepts_mail(domain: str) -> bool:
    now = time.time()
    cached = _email_domain_cache.get(domain)
    if cached and now - cached["checked_at"] < 3600:
        return cached["result"]

    result = True
    try:
        for record_type in ("MX", "A"):
            response = requests.get(
                "https://dns.google/resolve",
                params={"name": domain, "type": record_type},
                timeout=4,
            )
            if response.status_code == 200:
                payload = response.json()
                answers = payload.get("Answer") or []
                if answers:
                    result = True
                    break
                if record_type == "A":
                    result = False
    except Exception as exc:
        print(f"Email domain check skipped for {domain}: {exc}")
        result = True

    _email_domain_cache[domain] = {"result": result, "checked_at": now}
    return result

def validate_signup_email(email: str) -> str:
    normalized_email = (email or "").lower().strip()
    if not normalized_email or "@" not in normalized_email:
        raise HTTPException(status_code=400, detail="Inserisci una email valida.")
    domain = normalized_email.split("@", 1)[1]
    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(status_code=400, detail="L'utilizzo di email temporanee o usa e getta non è consentito.")
    if db.is_email_blocked_as_spam(normalized_email):
        raise HTTPException(status_code=403, detail="Questa email è stata bloccata come spam e non può essere usata.")
    return normalized_email

def validate_admin_target_email(email: str) -> str:
    normalized_email = validate_signup_email(email)
    domain = normalized_email.split("@", 1)[1]
    if not _domain_accepts_mail(domain):
        raise HTTPException(
            status_code=400,
            detail="Questa email sembra non poter ricevere posta. Controlla l’indirizzo prima di creare l’utente.",
        )
    return normalized_email

class BillingCustomerStatusRequest(BaseModel):
    status: str

@app.post("/api/register")
def register(req: RegisterRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"
    assert_signup_allowed(client_id)
    user_id = f"usr_{int(time.time())}"
    email = validate_signup_email(req.email)
    password = (req.password or "").strip()

    if len(password) < 8:
        record_signup_attempt(client_id)
        raise HTTPException(status_code=400, detail="Scegli una password di almeno 8 caratteri.")

    success = db.create_user(user_id, email, password, role="user", status="pending")
    if not success:
        record_signup_attempt(client_id)
        raise HTTPException(status_code=400, detail="L'email è già registrata.")

    confirmation_token = secrets.token_urlsafe(32)
    db.set_email_confirmation_token(user_id, confirmation_token)

    try:
        send_welcome_email(email, confirmation_token)
    except Exception as exc:
        db.delete_user(user_id)
        record_signup_attempt(client_id)
        raise HTTPException(
            status_code=500,
            detail=f"Registrazione non completata: impossibile inviare la mail di conferma. {exc}",
        )

    clear_signup_attempts(client_id)
    return {
        "status": "success",
        "message": "Ti abbiamo inviato una mail di benvenuto. Apri la mail e premi il pulsante di conferma per attivare davvero il tuo accesso.",
        "email": email,
    }

@app.post("/api/resend-confirmation")
def resend_confirmation(req: EmailRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"
    assert_signup_allowed(client_id)
    email = validate_signup_email(req.email)

    user = db.get_user_by_email(email)
    if not user:
        record_signup_attempt(client_id)
        raise HTTPException(status_code=404, detail="Nessun account trovato con questa email.")
    if user.get("email_verified_at"):
        return {
            "status": "success",
            "message": "Questa email è già confermata. Puoi entrare direttamente in Aureo.",
            "email": email,
            "already_verified": True,
        }

    sent_at = user.get("email_confirmation_sent_at")
    if sent_at:
        try:
            sent_dt = datetime.strptime(sent_at, "%Y-%m-%d %H:%M:%S")
            seconds_since = (datetime.utcnow() - sent_dt).total_seconds()
            if seconds_since < EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS:
                wait_seconds = int(EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS - seconds_since)
                raise HTTPException(
                    status_code=429,
                    detail=f"Aspetta ancora {wait_seconds} secondi prima di richiedere una nuova mail.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    confirmation_token = secrets.token_urlsafe(32)
    db.set_email_confirmation_token(user["id"], confirmation_token)
    try:
        send_welcome_email(email, confirmation_token)
    except Exception as exc:
        record_signup_attempt(client_id)
        raise HTTPException(
            status_code=500,
            detail=f"Impossibile inviare la mail di conferma in questo momento. {exc}",
        )

    clear_signup_attempts(client_id)
    return {
        "status": "success",
        "message": "Mail di conferma reinviata. Aprila e premi il pulsante per attivare l’accesso.",
        "email": email,
    }

@app.post("/api/login")
def login(req: LoginRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"
    assert_login_allowed(client_id)
    
    # Se inserisce solo la password (no email), prova l'Admin Login
    if not req.email:
        if is_admin_configured() and verify_admin_password(req.password):
            clear_login_failures(client_id)
            token = create_admin_session()
            return {"status": "success", "token": token, "expires_in": 86400, "role": "admin"}
    else:
        # Se c'è l'email, prova a loggare come Cliente SaaS
        email = req.email.lower().strip()
        if db.is_email_blocked_as_spam(email):
            record_login_failure(client_id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Questa email è stata bloccata come spam e non può accedere.")
        user = db.verify_user_login(email, req.password)
        if user:
            if not user.get("email_verified_at"):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "detail": "Prima di entrare in Aureo devi confermare la tua email dal pulsante che ti abbiamo inviato.",
                        "code": "email_not_verified",
                        "email": email,
                    },
                )
            clear_login_failures(client_id)
            token = create_user_token(user["id"], user["email"], user["role"])
            return {
                "status": "success", 
                "token": token, 
                "expires_in": 86400, 
                "role": user["role"],
                "user_status": user["status"]
            }

    record_login_failure(client_id)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide o accesso negato")

@app.get("/api/confirm-email", response_class=HTMLResponse)
def confirm_email(token: str = ""):
    token = (token or "").strip()
    if not token:
        return HTMLResponse(
            """
            <html><body style="background:#07111f;color:#e5eefc;font-family:Arial,sans-serif;padding:40px;">
            <div style="max-width:720px;margin:0 auto;background:#0b1626;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;">
            <h1>Link non valido</h1>
            <p>Manca il token di conferma. Torna alla mail ricevuta e usa il pulsante corretto.</p>
            <a href="https://aureoos.it" style="color:#7dd3fc;">Torna ad Aureo</a>
            </div></body></html>
            """,
            status_code=400,
        )

    user = db.confirm_user_email(token)
    if not user:
        return HTMLResponse(
            """
            <html><body style="background:#07111f;color:#e5eefc;font-family:Arial,sans-serif;padding:40px;">
            <div style="max-width:720px;margin:0 auto;background:#0b1626;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;">
            <h1>Conferma non valida</h1>
            <p>Questo link è scaduto oppure è già stato usato. Se serve, crea di nuovo il tuo accesso.</p>
            <a href="https://aureoos.it" style="color:#7dd3fc;">Apri Aureo</a>
            </div></body></html>
            """,
            status_code=400,
        )

    return HTMLResponse(
        f"""
        <html>
          <body style="margin:0;padding:0;background:#07111f;color:#e5eefc;font-family:Arial,sans-serif;">
            <div style="max-width:760px;margin:0 auto;padding:40px 20px;">
              <div style="background:#0b1626;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:34px;">
                <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.24);color:#86efac;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Email confermata</div>
                <h1 style="font-size:42px;line-height:1.05;margin:22px 0 14px;">Accesso verificato</h1>
                <p style="font-size:18px;line-height:1.7;color:#b7c5d9;">
                  Perfetto: la tua email è stata confermata. Ora puoi entrare in Aureo con le credenziali che hai appena creato.
                </p>
                <a href="{APP_BASE_URL}" style="display:inline-block;margin-top:10px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#08111b;text-decoration:none;font-weight:800;padding:16px 24px;border-radius:14px;font-size:16px;">
                  Apri Aureo
                </a>
                <p style="margin-top:18px;color:#8ea2bd;font-size:14px;">Email verificata: {user["email"]}</p>
              </div>
            </div>
          </body>
        </html>
        """,
        status_code=200,
    )


@app.post("/api/logout")
def logout(admin_token: str = Depends(require_admin)):
    revoke_admin_session(admin_token)
    return {"status": "success"}


@app.get("/api/user/me")
def get_current_user(user: dict = Depends(require_user)):
    """Returns the current logged-in user's profile and payment status."""
    user_id = user.get("sub")
    if not user_id or user_id == "admin":
        return {
            "id": "admin",
            "email": "admin",
            "role": "admin",
            "status": "active",
            "is_paid": True,
            "paid_at": None,
            "subscription_expires_at": None,
        }
    user_data = db.get_user_by_id(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    from datetime import datetime
    paid_at = user_data.get("paid_at")
    sub_expires = user_data.get("subscription_expires_at")
    
    # is_paid is true if they have paid_at set AND subscription not expired
    is_paid = False
    if paid_at:
        if sub_expires:
            try:
                exp = datetime.strptime(sub_expires, "%Y-%m-%d %H:%M:%S")
                is_paid = exp > datetime.utcnow()
            except Exception:
                is_paid = True
        else:
            is_paid = True
    
    return {
        "id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "status": user_data["status"],
        "email_verified_at": user_data.get("email_verified_at"),
        "email_verified": bool(user_data.get("email_verified_at")),
        "is_paid": is_paid,
        "paid_at": paid_at,
        "subscription_expires_at": sub_expires,
    }


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
                        "monthly_amount": plan.get("monthly_equivalent", plan.get("price_monthly", 0)),
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
    elevenlabs_key: str = ""
    theodds_key: str = ""
    groq_key: str = ""
    newsapi_key: str = ""
    google_cloud_json: str = ""
    trailing_stop_base_pct: float = 2.5
    dynamic_atr_stop: bool = True
    telegram_alerts_enabled: bool = True
    pushover_alerts_enabled: bool = True
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    pushover_app_token: str = ""
    pushover_user_key: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""


@app.get("/api/keys")
def get_keys(user: dict = Depends(require_user)):
    keys = {}
    try:
        if user.get("role") == "admin":
            # Global AI keys (masked) per admin, lette dal file .env
            if os.path.exists(API_KEYS_FILE):
                with open(API_KEYS_FILE, "r") as f:
                    for line in f:
                        if "=" in line:
                            k, v = line.strip().split("=", 1)
                            if v:
                                keys[k] = v[:4] + "***" if len(v) > 4 else "***"
            if os.path.exists(".env.gcp.json"):
                keys["GOOGLE_APPLICATION_CREDENTIALS"] = "MASKED_JSON"
            
        # Per le chiavi di trading (Alpaca, Binance, Kraken), le leggiamo dal DB per l'utente specifico
        user_keys = db.get_api_keys(user["sub"])
        user_bot_state = get_user_bot_state(user["sub"])
        if user_keys:
            if user_keys.get("alpaca_key"): keys["ALPACA_KEY"] = user_keys["alpaca_key"][:4] + "***"
            if user_keys.get("alpaca_secret"): keys["ALPACA_SECRET"] = user_keys["alpaca_secret"][:4] + "***"
            if user_keys.get("binance_key"): keys["BINANCE_KEY"] = user_keys["binance_key"][:4] + "***"
            if user_keys.get("binance_secret"): keys["BINANCE_SECRET"] = user_keys["binance_secret"][:4] + "***"
            if user_keys.get("kraken_key"): keys["KRAKEN_KEY"] = user_keys["kraken_key"][:4] + "***"
            if user_keys.get("kraken_secret"): keys["KRAKEN_SECRET"] = user_keys["kraken_secret"][:4] + "***"
            if user_keys.get("telegram_bot_token"): keys["TELEGRAM_BOT_TOKEN"] = user_keys["telegram_bot_token"][:4] + "***"
            if user_keys.get("telegram_chat_id"): keys["TELEGRAM_CHAT_ID"] = user_keys["telegram_chat_id"][:4] + "***"
            if user_keys.get("pushover_app_token"): keys["PUSHOVER_APP_TOKEN"] = user_keys["pushover_app_token"][:4] + "***"
            if user_keys.get("pushover_user_key"): keys["PUSHOVER_USER_KEY"] = user_keys["pushover_user_key"][:4] + "***"
            # Se l'utente non è admin, usa le AI keys dal suo DB
            if user.get("role") != "admin":
                if user_keys.get("groq_key"): keys["GROQ_KEY"] = user_keys["groq_key"][:4] + "***"
                if user_keys.get("elevenlabs_key"): keys["ELEVENLABS_KEY"] = user_keys["elevenlabs_key"][:4] + "***"
                if user_keys.get("theodds_key"): keys["THEODDS_KEY"] = user_keys["theodds_key"][:4] + "***"
                if user_keys.get("newsapi_key"): keys["NEWSAPI_KEY"] = user_keys["newsapi_key"][:4] + "***"
        keys["DYNAMIC_ATR_STOP"] = bool(getattr(user_bot_state, "dynamic_atr_stop", True))
        keys["TRAILING_STOP_BASE_PCT"] = float(getattr(user_bot_state, "trailing_stop_base_pct", 2.5))
        keys["TELEGRAM_ALERTS_ENABLED"] = bool(getattr(user_bot_state, "telegram_alerts_enabled", True))
        keys["PUSHOVER_ALERTS_ENABLED"] = bool(getattr(user_bot_state, "pushover_alerts_enabled", True))
                
    except Exception as e:
        keys["ERROR"] = str(e)
    return keys


@app.post("/api/keys")
def save_keys(req: KeysRequest, user: dict = Depends(require_user)):
    try:
        # 1. Salva chiavi nel database per l'utente
        user_keys = db.get_api_keys(user["sub"]) or {}
        user_bot_state = get_user_bot_state(user["sub"])
        
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
            groq_key=merge_user_key(req.groq_key, user_keys.get("groq_key")),
            elevenlabs_key=merge_user_key(req.elevenlabs_key, user_keys.get("elevenlabs_key")),
            theodds_key=merge_user_key(req.theodds_key, user_keys.get("theodds_key")),
            newsapi_key=merge_user_key(req.newsapi_key, user_keys.get("newsapi_key"))
            ,
            telegram_bot_token=merge_user_key(req.telegram_bot_token, user_keys.get("telegram_bot_token")),
            telegram_chat_id=merge_user_key(req.telegram_chat_id, user_keys.get("telegram_chat_id")),
            pushover_app_token=merge_user_key(req.pushover_app_token, user_keys.get("pushover_app_token")),
            pushover_user_key=merge_user_key(req.pushover_user_key, user_keys.get("pushover_user_key")),
        )
        user_bot_state.dynamic_atr_stop = bool(req.dynamic_atr_stop)
        user_bot_state.trailing_stop_base_pct = float(req.trailing_stop_base_pct or 2.5)
        user_bot_state.telegram_alerts_enabled = bool(req.telegram_alerts_enabled)
        user_bot_state.pushover_alerts_enabled = bool(req.pushover_alerts_enabled)
        user_bot_state.save_state()

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
    elevenlabs_key: str = ""
    theodds_key: str = ""
    newsapi_key: str = ""
    groq_key: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    pushover_app_token: str = ""
    pushover_user_key: str = ""
    binance_key: str = ""
    binance_secret: str = ""
    kraken_key: str = ""
    kraken_secret: str = ""

@app.post("/api/test-connection")
def test_connection(req: TestConnectionRequest, user: dict = Depends(require_user)):
    keys = {}
    
    if user.get("role") == "admin":
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        keys[k] = v
    
    # Per tutti gli utenti (incluso admin per alpaca_key, se li ha salvati nel db), leggiamo dal db
    user_keys = db.get_api_keys(user["sub"])
    if user_keys:
        if user_keys.get("alpaca_key"): keys["ALPACA_KEY"] = user_keys["alpaca_key"]
        if user_keys.get("alpaca_secret"): keys["ALPACA_SECRET"] = user_keys["alpaca_secret"]
        if user_keys.get("binance_key"): keys["BINANCE_KEY"] = user_keys["binance_key"]
        if user_keys.get("binance_secret"): keys["BINANCE_SECRET"] = user_keys["binance_secret"]
        if user_keys.get("telegram_bot_token"): keys["TELEGRAM_BOT_TOKEN"] = user_keys["telegram_bot_token"]
        if user_keys.get("telegram_chat_id"): keys["TELEGRAM_CHAT_ID"] = user_keys["telegram_chat_id"]
        if user_keys.get("pushover_app_token"): keys["PUSHOVER_APP_TOKEN"] = user_keys["pushover_app_token"]
        if user_keys.get("pushover_user_key"): keys["PUSHOVER_USER_KEY"] = user_keys["pushover_user_key"]
        if user.get("role") != "admin":
            if user_keys.get("groq_key"): keys["GROQ_KEY"] = user_keys["groq_key"]
            if user_keys.get("elevenlabs_key"): keys["ELEVENLABS_KEY"] = user_keys["elevenlabs_key"]
            if user_keys.get("theodds_key"): keys["THEODDS_KEY"] = user_keys["theodds_key"]
            if user_keys.get("newsapi_key"): keys["NEWSAPI_KEY"] = user_keys["newsapi_key"]
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
    if req.telegram_bot_token and "***" not in req.telegram_bot_token: keys['TELEGRAM_BOT_TOKEN'] = req.telegram_bot_token
    if req.telegram_chat_id and "***" not in req.telegram_chat_id: keys['TELEGRAM_CHAT_ID'] = req.telegram_chat_id
    if req.pushover_app_token and "***" not in req.pushover_app_token: keys['PUSHOVER_APP_TOKEN'] = req.pushover_app_token
    if req.pushover_user_key and "***" not in req.pushover_user_key: keys['PUSHOVER_USER_KEY'] = req.pushover_user_key
    

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
        elif service == 'telegram':
            bot_token = keys.get("TELEGRAM_BOT_TOKEN", "")
            chat_id = keys.get("TELEGRAM_CHAT_ID", "")
            if not bot_token or not chat_id:
                return {"status": "error", "message": "Credenziali Telegram mancanti."}
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": "Test Telegram riuscito: Aureo OS può inviarti alert critici.",
            }
            res = requests.post(url, json=payload, timeout=4)
            if res.status_code == 200:
                return {"status": "success", "message": "Connessione Telegram riuscita! Messaggio inviato."}
            return {"status": "error", "message": f"Telegram ha risposto con errore: {res.text}"}
        elif service == 'pushover':
            app_token = keys.get("PUSHOVER_APP_TOKEN", "")
            user_key = keys.get("PUSHOVER_USER_KEY", "")
            if not app_token or not user_key:
                return {"status": "error", "message": "Credenziali Pushover mancanti."}
            payload = {
                "token": app_token,
                "user": user_key,
                "title": "Aureo OS Test",
                "message": "Test Pushover riuscito: il bot può avvisarti su iPhone / Apple Watch.",
                "priority": 0,
            }
            res = requests.post("https://api.pushover.net/1/messages.json", data=payload, timeout=4)
            if res.status_code == 200:
                return {"status": "success", "message": "Connessione Pushover riuscita! Notifica inviata."}
            return {"status": "error", "message": f"Pushover ha risposto con errore: {res.text}"}
                
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

@app.post("/api/billing/verify-payment")
def verify_crypto_payment(req: VerifyPaymentRequest, admin_token: str = Depends(require_admin)):
    payments = db.get_all_payments()
    payment = next((p for p in payments if p["id"] == req.payment_id), None)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
        
    if req.action == "approve":
        db.update_payment_status(req.payment_id, "verified")
        from datetime import datetime, timedelta
        user = db.get_user_by_id(payment["user_id"])
        
        current_exp = user.get("subscription_expires_at")
        base_date = datetime.utcnow()
        if current_exp:
            try:
                parsed_exp = datetime.strptime(current_exp, "%Y-%m-%d %H:%M:%S")
                if parsed_exp > base_date:
                    base_date = parsed_exp
            except Exception:
                pass
            
        new_exp = base_date + timedelta(days=30 * req.months)
        db.update_subscription(payment["user_id"], new_exp.strftime("%Y-%m-%d %H:%M:%S"))
        return {"status": "success", "message": f"Pagamento approvato e abbonamento esteso fino a {new_exp.strftime('%Y-%m-%d')}"}
    else:
        db.update_payment_status(req.payment_id, "rejected")
        return {"status": "success", "message": "Pagamento rifiutato"}

class AdminUserActionRequest(BaseModel):
    user_id: str
    months: int = 1

class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "user"

class AdminEmailSpamRequest(BaseModel):
    email: str
    reason: str = ""

@app.post("/api/saas/create-user")
def admin_create_user(req: AdminCreateUserRequest, admin_token: str = Depends(require_admin)):
    import uuid
    new_user_id = str(uuid.uuid4())
    email = validate_admin_target_email(req.email)
    success = db.create_user(new_user_id, email, req.password, role=req.role, status="pending")
    if not success:
        raise HTTPException(status_code=400, detail="Email già in uso.")

    confirmation_token = secrets.token_urlsafe(32)
    db.set_email_confirmation_token(new_user_id, confirmation_token)
    try:
        send_welcome_email(email, confirmation_token)
    except Exception as exc:
        db.delete_user(new_user_id)
        raise HTTPException(
            status_code=500,
            detail=f"Utente non creato: impossibile inviare la mail di conferma. {exc}",
        )

    return {
        "status": "success",
        "message": "Utente creato e mail di conferma inviata. L’accesso si attiva dopo il click nella mail.",
        "user_id": new_user_id,
        "email": email,
    }

@app.post("/api/saas/email-history/mark-spam")
def admin_mark_email_spam(req: AdminEmailSpamRequest, admin_token: str = Depends(require_admin)):
    email = validate_admin_target_email(req.email)
    db.set_email_spam_status(email, True, req.reason)
    return {
        "status": "success",
        "message": f"{email} è stata marcata come spam e bloccata nei flussi Aureo.",
        "email": email,
    }

@app.post("/api/saas/email-history/unmark-spam")
def admin_unmark_email_spam(req: AdminEmailSpamRequest, admin_token: str = Depends(require_admin)):
    email = (req.email or "").lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Inserisci una email valida.")
    db.set_email_spam_status(email, False, "")
    return {
        "status": "success",
        "message": f"{email} è stata rimossa dalla lista spam.",
        "email": email,
    }

@app.post("/api/saas/resend-confirmation")
def admin_resend_confirmation(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato.")

    email = validate_signup_email(user.get("email", ""))
    if user.get("email_verified_at"):
        return {
            "status": "success",
            "message": "Questa email è già confermata. Non serve un nuovo invio.",
            "email": email,
            "already_verified": True,
        }

    sent_at = user.get("email_confirmation_sent_at")
    if sent_at:
        try:
            sent_dt = datetime.strptime(sent_at, "%Y-%m-%d %H:%M:%S")
            seconds_since = (datetime.utcnow() - sent_dt).total_seconds()
            if seconds_since < EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS:
                wait_seconds = int(EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS - seconds_since)
                raise HTTPException(
                    status_code=429,
                    detail=f"Aspetta ancora {wait_seconds} secondi prima di reinviare la conferma.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    confirmation_token = secrets.token_urlsafe(32)
    db.set_email_confirmation_token(req.user_id, confirmation_token)
    try:
        send_welcome_email(email, confirmation_token)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Impossibile inviare la mail di conferma in questo momento. {exc}",
        )

    return {
        "status": "success",
        "message": f"Mail di conferma reinviata a {email}.",
        "email": email,
    }

@app.post("/api/saas/activate-user")
def admin_activate_user(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = 'active' WHERE id = ?", (req.user_id,))
    
    # Imposta scadenza a 30 giorni da oggi
    from datetime import datetime, timedelta
    new_exp = datetime.utcnow() + timedelta(days=30)
    cursor.execute("UPDATE users SET subscription_expires_at = ? WHERE id = ?", (new_exp.strftime("%Y-%m-%d %H:%M:%S"), req.user_id))
    
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Utente attivato manualmente (Gratis)."}

@app.post("/api/saas/extend-user")
def admin_extend_user(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    from datetime import datetime, timedelta

    months = max(1, min(int(req.months or 1), 24))
    now = datetime.utcnow()
    base_date = now
    current_exp = user.get("subscription_expires_at")
    if current_exp:
        try:
            parsed_exp = datetime.strptime(current_exp, "%Y-%m-%d %H:%M:%S")
            if parsed_exp > base_date:
                base_date = parsed_exp
        except Exception:
            pass

    new_exp = base_date + timedelta(days=30 * months)
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET status = 'active', subscription_expires_at = ? WHERE id = ?",
        (new_exp.strftime("%Y-%m-%d %H:%M:%S"), req.user_id),
    )
    conn.commit()
    conn.close()
    return {
        "status": "success",
        "message": f"Abbonamento esteso di {months} mese/i fino al {new_exp.strftime('%Y-%m-%d')}.",
    }

@app.post("/api/saas/activate-paid")
def admin_activate_paid(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = 'active' WHERE id = ?", (req.user_id,))
    
    # Imposta scadenza a 30 giorni da oggi e segna come pagato
    from datetime import datetime, timedelta
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    new_exp = datetime.utcnow() + timedelta(days=30)
    cursor.execute("UPDATE users SET subscription_expires_at = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ?", (new_exp.strftime("%Y-%m-%d %H:%M:%S"), now_str, req.user_id))
    
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Utente attivato manualmente (PAGATO)."}

@app.post("/api/saas/activate-demo")
def admin_activate_demo(req: AdminUserActionRequest, admin_token: str = Depends(require_admin)):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = 'active' WHERE id = ?", (req.user_id,))
    
    # Imposta scadenza a 2 ore da oggi e finge un pagamento per sbloccare tutto
    from datetime import datetime, timedelta
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    new_exp = (datetime.utcnow() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE users SET subscription_expires_at = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ?", (new_exp, now_str, req.user_id))
    
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Demo full temporanea di 2 ore attivata."}

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
    email_history = db.get_email_history(100)
    payments = db.get_all_payments()
    
    from datetime import datetime as _dt
    now = _dt.utcnow()
    
    # Calcolo metriche
    active_customers = len([u for u in users if u["status"] == "active"])
    # MRR reale: solo clienti che hanno pagato E abbonamento non scaduto
    paying_users = []
    for u in users:
        if u.get("paid_at"):
            exp = u.get("subscription_expires_at")
            if exp:
                try:
                    if _dt.strptime(exp, "%Y-%m-%d %H:%M:%S") > now:
                        paying_users.append(u)
                except Exception:
                    paying_users.append(u)
            else:
                paying_users.append(u)
    mrr = len(paying_users) * 99
    
    # Formattazione per il frontend
    customers = []
    for u in users:
        paid_at = u.get("paid_at")
        sub_expires = u.get("subscription_expires_at")
        is_paid = False
        if paid_at:
            if sub_expires:
                try:
                    is_paid = _dt.strptime(sub_expires, "%Y-%m-%d %H:%M:%S") > now
                except Exception:
                    is_paid = True
            else:
                is_paid = True
        customers.append({
            "id": u["id"],
            "email": u["email"],
            "status": u["status"],
            "role": u["role"],
            "email_verified": bool(u.get("email_verified_at")),
            "email_verified_at": u.get("email_verified_at"),
            "next_billing_at": sub_expires or "N/A",
            "monthly_amount": 99,
            "created_at": u.get("created_at"),
            "paid_at": paid_at,
            "is_paid": is_paid,
        })
        
    return {
        "mrr": mrr,
        "active_customers": active_customers,
        "paying_customers": len(paying_users),
        "recent_activity": payments[:10], # Ultimi pagamenti
        "customers": customers,
        "email_history": email_history,
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
