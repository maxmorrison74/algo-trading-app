import os
import time
import asyncio
import datetime
import threading
import pandas as pd
from groq import Groq
import alpaca_trade_api as tradeapi
from alpaca_trade_api.stream import Stream
from ensemble_ml import EnsembleTradingModel

from risk_manager import get_risk_manager
from capital_manager import get_capital_manager


class AlpacaEngine:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.alpaca_rest = None
        self.alpaca_stream = None
        self.symbols = ["SPY", "QQQ", "AAPL", "MSFT", "TSLA", "NVDA"]
        self.llm_enabled = False
        self.llm_enabled = False
        self.history_buffers = {sym: pd.DataFrame() for sym in self.symbols}
        self.ml_models = {}
        self.active_trails = {}
        self._skip_log_cache = {}
        self.last_bar_received_at = None
        self.last_sync_at = None
        self.sync_failures = 0
        self.reconnect_attempts = 0
        
        # Start async loop thread for streaming
        self._stream_thread = None

    def init_clients(self, user_id="admin"):
        from db import get_api_keys
        # Init Alpaca
        keys = {}
        
        if user_id == "admin":
            try:
                keys_file = os.path.join(os.path.dirname(__file__), ".env.keys")
                with open(keys_file, "r") as f:
                    for line in f:
                        if "=" in line:
                            k, v = line.strip().split("=", 1)
                            keys[k] = v
            except Exception:
                pass
            
            user_keys = get_api_keys("admin") or {}
            
            db_alpaca = user_keys.get("alpaca_key", "").strip(' \t\n\r"\'')
            self.alpaca_key = db_alpaca if db_alpaca else keys.get("ALPACA_KEY", os.getenv("ALPACA_API_KEY", "")).strip(' \t\n\r"\'')
            
            db_secret = user_keys.get("alpaca_secret", "").strip(' \t\n\r"\'')
            self.alpaca_secret = db_secret if db_secret else keys.get("ALPACA_SECRET", os.getenv("ALPACA_SECRET_KEY", "")).strip(' \t\n\r"\'')
            
            # Auto-detect LIVE vs PAPER
            if self.alpaca_key.startswith("AK"):
                self.alpaca_base = "https://api.alpaca.markets"
            else:
                self.alpaca_base = "https://paper-api.alpaca.markets"
                
            db_groq = user_keys.get("groq_key", "").strip(' \t\n\r"\'')
            groq_key = db_groq if db_groq else keys.get("GROQ_KEY", os.getenv("GROQ_API_KEY", "")).strip(' \t\n\r"\'')
        else:
            user_keys = get_api_keys(user_id) or {}
            self.alpaca_key = user_keys.get("alpaca_key", "").strip(' \t\n\r"\'')
            self.alpaca_secret = user_keys.get("alpaca_secret", "").strip(' \t\n\r"\'')
            
            # Auto-detect LIVE vs PAPER
            if self.alpaca_key.startswith("AK"):
                self.alpaca_base = "https://api.alpaca.markets"
            else:
                self.alpaca_base = "https://paper-api.alpaca.markets"
                
            groq_key = user_keys.get("groq_key", "").strip(' \t\n\r"\'')
        
        if self.alpaca_key and self.alpaca_secret:
            try:
                self.alpaca_rest = tradeapi.REST(self.alpaca_key, self.alpaca_secret, self.alpaca_base, api_version='v2')
                
                # Carica dinamicamente i simboli dal bot_state
                if self.bot_state.target_symbols:
                    self.symbols = self.bot_state.target_symbols
                    self.history_buffers = {sym: pd.DataFrame() for sym in self.symbols}
                    
                self.sync_portfolio()
            except Exception as e:
                self._log(f"❌ ERRORE: Chiavi Alpaca rifiutate. Le API Keys correnti in memoria non funzionano: {e}")
                self.alpaca_rest = None
                self.running = False
                self.bot_state.modules["trading"] = False
                self.bot_state.save_state()
                
        kimi_key = ""
        if isinstance(user_keys, dict):
            kimi_key = user_keys.get("kimi_key", "").strip(' \t\n\r"\'')
        if kimi_key:
            self.kimi_key = kimi_key
            self.llm_provider = "kimi"
            self.llm_enabled = True
            self._log("🧠 AI Predictor: Kimi (Moonshot) attivato.")
        elif groq_key:
            self.model = Groq(api_key=groq_key)
            self.llm_provider = "groq"
            self.llm_enabled = True
            self._log("Modulo AI Sentiment basato su notizie in tempo reale abilitato (Groq LLaMA3).")
        
        if not self.llm_enabled:
            self._log("Avviso: Nessuna chiave AI (Groq/Kimi) trovata. Trading solo su Analisi Tecnica e LSTM.")
            
        # I modelli LSTM verranno caricati dinamicamente da get_ml_model per evitare OOM sul VPS
        
    def get_ml_model(self, symbol):
        import gc
        import os
        try:
            from keras import backend as K
        except ImportError:
            return None
            
        if symbol in self.ml_models:
            return self.ml_models[symbol]
            
        # Per evitare OOM ma mantenere la cache, teniamo fino a 15 modelli in memoria
        if len(self.ml_models) > 15:
            oldest = next(iter(self.ml_models))
            del self.ml_models[oldest]
            try:
                K.clear_session()
                gc.collect()
            except: pass
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(base_dir, "models")
        
        model_path = os.path.join(models_dir, f"{symbol}_model.keras")
        super_model_path = os.path.join(models_dir, "SUPER_MODEL.keras")
        
        if not os.path.exists(model_path) and os.path.exists(super_model_path):
            model_path = super_model_path
            
        if os.path.exists(model_path):
            self._log(f"🧠 Caricamento Lazy Modello ML per {symbol} dal file {os.path.basename(model_path)}...")
            from ensemble_ml import EnsembleTradingModel
            model = EnsembleTradingModel()
            model.load(model_path)
            self.ml_models[symbol] = model
            return model
            
        return None

    def sync_portfolio(self):
        try:
            account = self.alpaca_rest.get_account()
            self.bot_state.virtual_cash = float(account.portfolio_value)
            self.last_sync_at = time.time()
            self.sync_failures = 0
            self._runtime_health(
                status="green",
                summary="Portfolio sincronizzato",
                last_sync_at=datetime.datetime.now().isoformat(),
                sync_failures=0,
            )
            
            # Sincronizza Trailing Stops interni per eventuali posizioni orfane o chiuse
            try:
                positions = self.alpaca_rest.list_positions()
                risk = get_risk_manager(self.bot_state.virtual_cash)
                risk.state.open_positions = len(positions)
                risk._save_state()
                active_symbols = set()
                for p in positions:
                    # Clean symbol (es. BTC/USD -> BTCUSD per coerenza interna)
                    sym_clean = p.symbol.replace('/', '')
                    # Mappiamo al symbol originale per la cronologia se esiste
                    sym = next((s for s in self.symbols if self.clean_sym(s) == sym_clean), sym_clean)
                    active_symbols.add(sym)
                    
                    if sym not in self.active_trails:
                        side = "LONG" if float(p.qty) > 0 else "SHORT"
                        restored_trail_percent = float(getattr(self.bot_state, 'trailing_stop_base_pct', 2.5) or 2.5)
                        self.active_trails[sym] = {
                            'side': side,
                            'qty': abs(float(p.qty)),
                            'entry_price': float(p.avg_entry_price),
                            'peak_price': float(p.current_price),
                            'trail_percent': restored_trail_percent
                        }
                        self._log(f"🛡️ Ripristinato Trailing Stop interno al {restored_trail_percent:.2f}% per {sym}")
                
                # Rimuovi trail se la posizione è stata chiusa manualmente dalla dashboard di Alpaca
                for sym in list(self.active_trails.keys()):
                    if sym not in active_symbols:
                        del self.active_trails[sym]
            except Exception as e:
                pass
                
        except Exception as e:
            self.sync_failures += 1
            self._runtime_health(
                status="yellow" if self.sync_failures < 3 else "red",
                summary=f"Errore sync portfolio ({self.sync_failures})",
                last_error=str(e),
                sync_failures=self.sync_failures,
            )
            self._log(f"❌ ERRORE: Chiavi Alpaca non valide o account non autorizzato. {e}")
            raise e

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.add_log(f"[{timestamp}] 📈 ALPACA: {message}")

    def _get_time_in_force(self, symbol):
        return 'gtc' if '/' in symbol else 'day'

    def _log_throttled_skip(self, symbol, reason_key, message, cooldown_seconds=900):
        now = time.time()
        cache_key = f"{symbol}:{reason_key}"
        last_logged_at = self._skip_log_cache.get(cache_key, 0)
        if now - last_logged_at >= cooldown_seconds:
            self._skip_log_cache[cache_key] = now
            self._log(message)

    def _normalize_llm_confidence(self, raw_confidence):
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            return 3

        if confidence <= 1:
            confidence *= 5

        confidence = round(confidence)
        return max(1, min(int(confidence), 5))

    def _runtime_health(self, persist=False, **kwargs):
        now_iso = datetime.datetime.now().isoformat()
        payload = {
            "last_heartbeat_at": now_iso,
            **kwargs,
        }
        self.bot_state.set_runtime_health(persist=persist, **payload)

    def _auto_pause(self, reason: str):
        self.running = False
        self.bot_state.modules["trading"] = False
        self._runtime_health(
            persist=True,
            status="red",
            auto_paused=True,
            auto_pause_reason=reason,
            summary=reason,
            websocket_connected=False,
            last_error=reason,
        )
        self._log(f"🛑 AUTO-PAUSE DI SICUREZZA: {reason}")
        try:
            from api import send_critical_alert
            send_critical_alert(f"🛑 Auto-pause bot trading\nMotivo: {reason}", user_id=getattr(self, 'user_id', 'admin'))
        except Exception:
            pass

    def predict_pattern_with_groq(self, symbol, close_prices):
        # Legacy stub — redirects to the real implementation below
        return self.predict_pattern_with_ai(symbol, close_prices)

    def predict_pattern_with_ai(self, symbol, closes):
        if not self.llm_enabled:
            return "NO_LLM"
        try:
            import json
            import requests
            trend = "crescente" if closes.iloc[-1] > closes.iloc[0] else "decrescente"
            prompt = (
                f"Analizza questo micro-trend per {symbol} negli ultimi 5 minuti. "
                f"Il trend è {trend}. "
                f"Rispondi RIGIDAMENTE in formato JSON con questa struttura:\n"
                f"{{\n"
                f"  \"prediction\": \"UP\" | \"DOWN\",\n"
                f"  \"confidence\": 1,\n"
                f"  \"reason\": \"spiegazione\"\n"
                f"}}"
            )
            
            if getattr(self, 'llm_provider', 'groq') == "kimi":
                headers = {
                    "Authorization": f"Bearer {self.kimi_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "moonshot-v1-8k",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3
                }
                resp = requests.post("https://api.moonshot.cn/v1/chat/completions", json=payload, headers=headers)
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    start = content.find('{')
                    end = content.rfind('}') + 1
                    if start != -1 and end != -1:
                        data = json.loads(content[start:end])
                    else:
                        data = json.loads(content)
                else:
                    return "UP"
            else:
                response = self.model.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.1-8b-instant",
                    response_format={"type": "json_object"}
                )
                data = json.loads(response.choices[0].message.content)
                
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if not isinstance(data, dict):
                data = {}
                
            prediction = data.get("prediction", "UP").strip().upper()
            confidence = self._normalize_llm_confidence(data.get("confidence", 3))
            self._log(f"🧠 AI Predictor per {symbol}: {prediction} (Confidenza: {confidence}/5) - {data.get('reason')}")
            return prediction
        except Exception as e:
            self._log(f"Errore LLM Pattern Predictor per {symbol}: {e}")
            return "UP"

    def get_llm_sentiment_with_confidence(self, symbol):
        if not self.llm_enabled:
            return "NEUTRAL", 3, "LLM Disabilitato"
            
        try:
            import json
            news = self.alpaca_rest.get_news(symbol, limit=6)
            headlines = [n.headline for n in news]
            if not headlines:
                return "NEUTRAL", 3, "Nessuna notizia recente."
                
            prompt = (
                f"Analizza il sentiment di queste notizie finanziarie su {symbol}.\n"
                f"Notizie:\n"
            )
            for n in headlines:
                prompt += f"- {n}\n"
            prompt += (
                f"\nRispondi RIGIDAMENTE in formato JSON con la seguente struttura:\n"
                f"{{\n"
                f"  \"sentiment\": \"BULLISH\" | \"BEARISH\" | \"NEUTRAL\",\n"
                f"  \"confidence\": 1,\n"
                f"  \"reason\": \"breve spiegazione\"\n"
                f"}}"
            )
                
            if getattr(self, 'llm_provider', 'groq') == "kimi":
                import requests
                headers = {
                    "Authorization": f"Bearer {self.kimi_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "moonshot-v1-8k",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3
                }
                resp = requests.post("https://api.moonshot.cn/v1/chat/completions", json=payload, headers=headers)
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    start = content.find('{')
                    end = content.rfind('}') + 1
                    if start != -1 and end != -1:
                        data = json.loads(content[start:end])
                    else:
                        data = json.loads(content)
                else:
                    return "NEUTRAL", 3, "Errore API Kimi"
            else:
                response = self.model.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.1-8b-instant",
                    response_format={"type": "json_object"}
                )
                data = json.loads(response.choices[0].message.content)
                
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if not isinstance(data, dict):
                data = {}
                
            sentiment = data.get("sentiment", "NEUTRAL").strip().upper()
            confidence = self._normalize_llm_confidence(data.get("confidence", 3))
            reason = data.get('reason', 'Nessun motivo fornito')
            return sentiment, confidence, reason
        except Exception as e:
            self._log(f"Errore LLM Sentiment API: {e}")
            return "NEUTRAL", 3, "Errore API LLM"

    def format_price(self, price):
        if price >= 1.0:
            return round(price, 2)
        else:
            return round(price, 4)

    def is_market_open_for_symbol(self, symbol):
        if "/" in symbol: # Crypto is 24/7
            return True
        import pytz
        ny_tz = pytz.timezone('America/New_York')
        now_ny = datetime.datetime.now(ny_tz)
        # Check if weekend
        if now_ny.weekday() >= 5:
            return False
        # Check RTH 9:30 to 16:00
        market_open = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_ny.replace(hour=16, minute=0, second=0, microsecond=0)
        return market_open <= now_ny <= market_close

    def has_open_position(self, symbol):
        try:
            positions = self.alpaca_rest.list_positions()
            for p in positions:
                if p.symbol == symbol.replace("/", ""):
                    return True
            return False
        except Exception:
            return False

    def clean_sym(self, sym):
        # Alpaca crypto API v2 requires the slash (e.g. BTC/USD)
        return sym

    def prefill_history(self):
        """Pre-carica 50 candele storiche per ogni simbolo per calcolare RSI/BB subito"""
        if not self.alpaca_rest: return
        self._log("Pre-caricamento storico candele (REST)...")
        for sym in self.symbols:
            try:
                query_sym = self.clean_sym(sym)
                if "/" in sym:
                    try:
                        bars = self.alpaca_rest.get_crypto_bars(query_sym, tradeapi.TimeFrame.Minute, limit=150).df
                    except AttributeError:
                        bars = self.alpaca_rest.get_bars(query_sym, tradeapi.TimeFrame.Minute, limit=150).df
                else:
                    bars = self.alpaca_rest.get_bars(query_sym, tradeapi.TimeFrame.Minute, limit=150).df
                    
                if not bars.empty:
                    self.history_buffers[sym] = bars
                    # Calcola subito la predizione iniziale ad ogni avvio!
                    self.evaluate_strategy(sym, bars)
            except Exception as e:
                self._log(f"Errore history {sym}: {e}")

    def _execute_exit(self, symbol, qty, side):
        try:
            self.alpaca_rest.submit_order(
                symbol=self.clean_sym(symbol),
                qty=qty,
                side=side,
                type='market',
                time_in_force=self._get_time_in_force(symbol)
            )
            self._log(f"✅ POSIZIONE CHIUSA su {symbol} (Market Order).")
        except Exception as e:
            self._log(f"❌ ERRORE CHIUSURA {symbol}: {e}")

    async def on_bar(self, bar):
        sym = bar.symbol
        if sym not in self.symbols: return
        self.last_bar_received_at = time.time()
        self._runtime_health(
            status="green",
            summary=f"Feed attivo su {sym}",
            last_bar_at=datetime.datetime.now().isoformat(),
            websocket_connected=True,
            reconnect_attempts=0,
        )
        
        current_price = bar.close
        
        # Gestione Trailing Stop Interno in Real-Time
        if sym in self.active_trails:
            trail = self.active_trails[sym]
            
            if trail['side'] == "LONG":
                if current_price > trail['peak_price']:
                    trail['peak_price'] = current_price
                
                stop_price = trail['peak_price'] * (1 - trail['trail_percent'] / 100.0)
                if current_price <= stop_price:
                    msg_log = f"🛑 TRAILING STOP COLPITO su {sym} (LONG). Prezzo è sceso del {trail['trail_percent']}% dal picco massimo."
                    self._log(msg_log)
                    self._execute_exit(sym, trail['qty'], 'sell')
                    pnl = (current_price - trail['entry_price']) * trail['qty']
                    get_capital_manager().record_trade_result(pnl)
                    del self.active_trails[sym]
                    
                    try:
                        from api import send_telegram_message
                        msg = f"🛑 *TRADE CHIUSO (Trailing Stop)*\nAsset: {sym}\nLungo chiuso a: ${current_price:.2f}\nProfitto/Perdita: ${pnl:.2f}"
                        send_telegram_message(msg)
                    except: pass
                    
            elif trail['side'] == "SHORT":
                if current_price < trail['peak_price']:
                    trail['peak_price'] = current_price
                
                stop_price = trail['peak_price'] * (1 + trail['trail_percent'] / 100.0)
                if current_price >= stop_price:
                    msg_log = f"🛑 TRAILING STOP COLPITO su {sym} (SHORT). Prezzo è salito del {trail['trail_percent']}% dal picco minimo."
                    self._log(msg_log)
                    self._execute_exit(sym, trail['qty'], 'buy')
                    pnl = (trail['entry_price'] - current_price) * trail['qty']
                    get_capital_manager().record_trade_result(pnl)
                    del self.active_trails[sym]
                    
                    try:
                        from api import send_telegram_message
                        msg = f"🛑 *TRADE CHIUSO (Trailing Stop)*\nAsset: {sym}\nShort chiuso a: ${current_price:.2f}\nProfitto/Perdita: ${pnl:.2f}"
                        send_telegram_message(msg)
                    except: pass

        # Converte l'oggetto bar in un formato compatibile con il dataframe
        new_row = pd.DataFrame([{
            'open': bar.open,
            'high': bar.high,
            'low': bar.low,
            'close': bar.close,
            'volume': bar.volume
        }], index=[bar.timestamp])
        
        df = self.history_buffers[sym]
        df = pd.concat([df, new_row])
        # Mantieni solo le ultime 150 candele per non ingolfare la memoria ma garantire dati a sufficienza per MACD/LSTM
        df = df.tail(150)
        self.history_buffers[sym] = df
        
        self.evaluate_strategy(sym, df)

    def evaluate_strategy(self, symbol, df):
        if len(df) < 20: return
        
        close_prices = df['close']
        current_price = float(close_prices.iloc[-1])
        
        # RSI 14
        delta = close_prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = float((100 - (100 / (1 + rs))).iloc[-1])
        
        # Bollinger Bands 20
        rolling_mean = close_prices.rolling(window=20).mean()
        rolling_std = close_prices.rolling(window=20).std()
        bb_lower = float((rolling_mean - (rolling_std * 2)).iloc[-1])
        bb_upper = float((rolling_mean + (rolling_std * 2)).iloc[-1])
        
        # Calcolo ATR (Average True Range) a 14 periodi
        highs = df['high']
        lows = df['low']
        closes = df['close']
        prev_closes = closes.shift(1)
        tr = pd.concat([
            highs - lows,
            (highs - prev_closes).abs(),
            (lows - prev_closes).abs()
        ], axis=1).max(axis=1)
        atr_series = tr.rolling(window=14).mean()
        
        if len(atr_series) >= 14 and not pd.isna(atr_series.iloc[-1]):
            atr = float(atr_series.iloc[-1])
        else:
            atr = current_price * 0.01

        # Calcolo MACD (12, 26, 9)
        exp1 = close_prices.ewm(span=12, adjust=False).mean()
        exp2 = close_prices.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        macd_signal = macd.ewm(span=9, adjust=False).mean()
        macd_hist = macd - macd_signal
        current_macd_hist = float(macd_hist.iloc[-1])
        
        # Calcolo VWAP Intraday semplificato sulle candele caricate
        try:
            volumes = df['volume']
            typical_price = (highs + lows + closes) / 3
            vwap = float((typical_price * volumes).sum() / volumes.sum())
        except Exception:
            vwap = current_price
            
        # 🤖 Predizione LSTM Quantitativa
        lstm_prob = 0.5
        try:
            model = self.get_ml_model(symbol)
            if model:
                lstm_prob = model.predict_realtime(df)
        except Exception as e:
            pass

        # ⏱️ Multi-Timeframe Analysis (Macro Trend su 5 Minuti)
        try:
            # Assicuriamoci che l'indice sia datetime
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index)
            
            macro_close = df['close'].resample('5Min').last().dropna()
            if len(macro_close) >= 14:
                macro_delta = macro_close.diff()
                macro_gain = (macro_delta.where(macro_delta > 0, 0)).rolling(window=14).mean()
                macro_loss = (-macro_delta.where(macro_delta < 0, 0)).rolling(window=14).mean()
                macro_rs = macro_gain / macro_loss
                macro_rsi = float((100 - (100 / (1 + macro_rs))).iloc[-1])
            else:
                macro_rsi = 50 # Default neutro se non ci sono abbastanza barre
        except Exception as e:
            macro_rsi = 50
        
        self.bot_state.latest_predictions[symbol] = f"LSTM: {lstm_prob*100:.1f}% | RSI(1M): {rsi:.1f} | MACD: {current_macd_hist:.2f} | VWAP: {vwap:.2f}"
        
        # Filtro "Anti-Noia" (Volatilità Estrema Richiesta)
        atr_percent = atr / current_price
        if atr_percent < 0.0008: # Se il prezzo si muove meno dello 0.08% al minuto in media, ignoriamo (mercato piatto)
             if "/" in symbol:
                 self._log_throttled_skip(
                     symbol,
                     "flat_market",
                     f"ℹ️ CRYPTO CHECK {symbol}: feed ok, ma volatilità troppo bassa ({atr_percent*100:.3f}% ATR/price). Nessun ingresso forzato."
                 )
             return
        
        # Check Long (Mean Reversion O Breakout Momentum O MACD Crossover)
        # Strategia 1: Crollo Ipervenduto (Mean Reversion)
        is_mean_reversion_long = (current_price < bb_lower and rsi < 35)
        # Strategia 2: Breakout al rialzo (Momentum Veloce)
        is_momentum_long = (current_price > bb_upper and rsi > 55)
        # Strategia 3: MACD Crossover Long supportato da VWAP
        is_macd_vwap_long = (current_macd_hist > 0 and rsi > 50 and current_price > vwap)
        
        # Check Short (Mean Reversion dall'alto O MACD Crossover Ribassista)
        is_mean_reversion_short = (current_price > bb_upper and rsi > 65)
        is_macd_vwap_short = (current_macd_hist < 0 and rsi < 50 and current_price < vwap)
        
        if is_mean_reversion_long or is_momentum_long or is_macd_vwap_long:
            if lstm_prob > 0.55: # Scalping: abbassato a 55%
                pattern = self.predict_pattern_with_groq(symbol, close_prices)
                if pattern in ["UP", "NO_LLM"]:
                    if is_macd_vwap_long: strategy_name = "MACD TREND"
                    elif is_momentum_long: strategy_name = "MOMENTUM SCALPING"
                    else: strategy_name = "MEAN REVERSION"
                    self._log(f"⚡ FAST SCALP {strategy_name} ATTIVATO su {symbol}")
                    self.execute_trade(symbol, current_price, "LONG", atr, lstm_prob)
                else:
                    self._log(f"🧠 AI VETO: Groq non conferma UP. Scalp annullato.")
            else:
                 self._log(f"🤖 LSTM VETO: Setup LONG su {symbol} (Prob={lstm_prob*100:.1f}%) < 55%.")
            
        elif (is_mean_reversion_short or is_macd_vwap_short) and lstm_prob < 0.45:
            pattern = self.predict_pattern_with_groq(symbol, close_prices)
            if pattern in ["DOWN", "NO_LLM"]:
                strategy_name = "MACD TREND SHORT" if is_macd_vwap_short else "MEAN REVERSION SHORT"
                self._log(f"⚡ FAST SCALP {strategy_name} ATTIVATO su {symbol}")
                self.execute_trade(symbol, current_price, "SHORT", atr, lstm_prob)
            else:
                self._log(f"🧠 AI VETO: Groq non conferma DOWN. Scalp annullato.")
        elif "/" in symbol:
            self._log_throttled_skip(
                symbol,
                "no_setup",
                f"ℹ️ CRYPTO CHECK {symbol}: feed ok, nessun setup tecnico valido in questo momento."
            )

    def is_shortable(self, symbol):
        if not hasattr(self, "_shortable_cache"):
            self._shortable_cache = {}
        if symbol in self._shortable_cache:
            return self._shortable_cache[symbol]
        if "/" in symbol:
            self._shortable_cache[symbol] = False
            return False
        try:
            asset = self.alpaca_rest.get_asset(symbol)
            self._shortable_cache[symbol] = asset.shortable
            return asset.shortable
        except Exception:
            self._shortable_cache[symbol] = False
            return False



    def execute_trade(self, symbol, current_price, side, atr, lstm_prob=0.5):
        self._log(f"⚡ SETUP {side} RILEVATO su {symbol}: Prezzo {current_price:.2f} (ATR: {atr:.2f})")
        
        if not self.is_market_open_for_symbol(symbol):
            self._log(f"🕒 RTH FILTER: Il mercato per {symbol} è chiuso. Ignoro segnale.")
            return

        if self.has_open_position(symbol):
            self._log(f"🛡️ RISK FILTER: Posizione già aperta su {symbol}. Ignoro per evitare spari multipli.")
            return

        if side == "SHORT" and not self.is_shortable(symbol):
            self._log(f"⚠️ SKIP SHORT su {symbol}: L'asset non è shortabile su Alpaca. Operazione annullata.")
            return
            
        sentiment, confidence, reason = self.get_llm_sentiment_with_confidence(symbol)
        
        # Veto basato su sentiment
        if side == "LONG" and sentiment == "BEARISH":
            self._log(f"🧠 AI VETO: Sentiment Bearish per {symbol}. Long annullato. Motivo AI: {reason}")
            return
        elif side == "SHORT" and sentiment == "BULLISH":
            self._log(f"🧠 AI VETO: Sentiment Bullish per {symbol}. Short annullato. Motivo AI: {reason}")
            return
            
        # Veto basato su bassa confidenza (1 o 2)
        if confidence <= 2:
            self._log(f"🧠 AI VETO: Confidenza Groq troppo bassa ({confidence}/5). Operazione annullata. Motivo AI: {reason}")
            return
            
        self._log(f"🧠 AI CONFERMA: Sentiment = {sentiment} ({confidence}/5). Esecuzione! [MOTIVO AI: {reason}]")
        
        risk = get_risk_manager(self.bot_state.virtual_cash)
        can_trade, risk_reason = risk.can_trade()
        if not can_trade:
            self._log(f"⛔ {risk_reason}")
            return
            
        # Position Sizing con Advanced Kelly Criterion (dal Risk Manager)
        # Per SHORT, la confidence è l'inverso della probabilità LSTM di salire
        base_confidence = lstm_prob if side == "LONG" else (1.0 - lstm_prob)
        
        # Se il setup tecnico è forte ma LSTM è neutro (es. 0.5), forziamo una confidence minima
        if base_confidence <= 0.5:
            base_confidence = 0.55
        
        # Boost aggressivo solo per setup eccellenti
        if base_confidence > 0.75:
            base_confidence = min(base_confidence * 1.5, 0.95)
            
        qty = risk.get_position_size(confidence=base_confidence, price=current_price)
        
        # Moltiplichiamo per l'aggressività dell'utente (0 - 100)
        agg_factor = self.bot_state.aggressiveness / 50.0  # Default 55 = 1.1x
        qty *= agg_factor
        
        cap = get_capital_manager()
        max_cap_fraction = cap.get_trade_size_limit()
        max_qty = (self.bot_state.virtual_cash * max_cap_fraction) / current_price if current_price > 0 else 0
        qty = min(qty, round(max_qty, 4))
        
        # Le crypto ammettono frazioni, le azioni dipendono dal broker. Arrotondiamo a 4 decimali.
        qty = round(qty, 4)
        
        # Alpaca NON permette la vendita allo scoperto (SHORT) di azioni frazionate. Deve essere un numero intero.
        if side == "SHORT":
            qty = int(qty)
            if qty < 1:
                self._log(f"⚠️ SHORT su {symbol} annullato: Capitale insufficiente per vendere allo scoperto almeno 1 azione intera (Alpaca non permette short frazionati).")
                return
        
        if qty <= 0.0001: return
        
        alpaca_side = 'buy' if side == "LONG" else 'sell'
        clean_symbol = self.clean_sym(symbol)
        
        dynamic_atr_stop = bool(getattr(self.bot_state, 'dynamic_atr_stop', True))
        fixed_trailing_stop = float(getattr(self.bot_state, 'trailing_stop_base_pct', 2.5) or 2.5)
        if dynamic_atr_stop:
            atr_percent = atr / current_price if current_price > 0 else 0.01
            trail_percent = max(0.5, min(4.0, atr_percent * 100 * 1.5))
            trail_percent = round(trail_percent, 2)
        else:
            trail_percent = round(max(0.5, min(5.0, fixed_trailing_stop)), 2)
        
        try:
            is_fractional = (qty % 1 != 0)
            time_in_force = self._get_time_in_force(symbol)
            
            if is_fractional:
                # Alpaca NON supporta order_class='trailing_stop' per ordini frazionati.
                self.alpaca_rest.submit_order(
                    symbol=clean_symbol,
                    qty=qty,
                    side=alpaca_side,
                    type='market',
                    time_in_force=time_in_force
                )
                self._log(f"🚀 ORDINE {side} {qty} {symbol} INVIATO (Ordine Semplice - No Trailing Stop per le Frazioni, TIF {time_in_force.upper()})")
            else:
                qty = int(qty)
                # Ordine a Mercato Semplice (Alpaca non supporta trailing stop come OTO class in questo formato)
                self.alpaca_rest.submit_order(
                    symbol=clean_symbol,
                    qty=qty,
                    side=alpaca_side,
                    type='market',
                    time_in_force=time_in_force
                )
                self._log(f"🚀 ORDINE {side} {qty} {symbol} INVIATO (Ordine Semplice a Mercato, TIF {time_in_force.upper()})")
            
            # Registra il trailing stop in memoria!
            self.active_trails[symbol] = {
                'side': side,
                'qty': qty,
                'entry_price': current_price,
                'peak_price': current_price,
                'trail_percent': trail_percent
            }
            
            # Notifica Telegram
            try:
                from api import send_telegram_message
                msg = f"🚀 *TRADE AUTOMATICO (Alpaca)*\n"
                msg += f"Asset: {symbol}\n"
                msg += f"Azione: {side}\n"
                msg += f"Quantità: {qty}\n"
                msg += f"Prezzo: ${current_price:.2f}\n"
                msg += f"Trailing Stop: {trail_percent}% ({'ATR dinamico' if dynamic_atr_stop else 'fisso'})\n"
                msg += f"Probabilità AI: {lstm_prob*100:.1f}%\n"
                send_telegram_message(msg)
            except Exception as e:
                self._log(f"⚠️ Errore invio notifica Telegram: {e}")
                
        except Exception as e:
            self._log(f"❌ ERRORE INVIO ORDINE: {e}")

    def _stream_runner(self):
        stock_symbols = [s for s in self.symbols if "/" not in s]
        crypto_symbols = [self.clean_sym(s) for s in self.symbols if "/" in s]
        
        if not stock_symbols and not crypto_symbols:
            self._log("Avviso: Nessun asset azionario o crypto da ascoltare via WebSocket.")
            return

        reconnect_attempts = 0
        while self.running and self.bot_state.modules.get("trading", False):
            try:
                self.alpaca_stream = Stream(self.alpaca_key, self.alpaca_secret, base_url=self.alpaca_base, data_feed='iex')
                if stock_symbols:
                    self.alpaca_stream.subscribe_bars(self.on_bar, *stock_symbols)
                if crypto_symbols:
                    self.alpaca_stream.subscribe_crypto_bars(self.on_bar, *crypto_symbols)
                
                self._log(f"📡 WebSocket Connesso: in attesa di stream tick-by-tick ({len(stock_symbols)} stocks, {len(crypto_symbols)} crypto)...")
                reconnect_attempts = 0
                self.reconnect_attempts = 0
                self._runtime_health(
                    status="green",
                    summary="WebSocket connesso",
                    websocket_connected=True,
                    reconnect_attempts=0,
                )
                self.alpaca_stream.run()
            except ValueError as ve:
                if "auth failed" in str(ve).lower():
                    self._auto_pause("Chiavi Alpaca rifiutate dal WebSocket")
                    break
                else:
                    self._log(f"❌ WebSocket errore: {ve}")
                    self._runtime_health(
                        status="yellow",
                        summary="WebSocket in errore",
                        websocket_connected=False,
                        last_error=str(ve),
                    )
            except Exception as e:
                if self.running:
                    self._log(f"❌ WebSocket disconnesso ({e}). Tentativo di riconnessione in corso...")
                    self._runtime_health(
                        status="yellow",
                        summary="WebSocket disconnesso",
                        websocket_connected=False,
                        last_error=str(e),
                    )
            
            if self.running and self.bot_state.modules.get("trading", False):
                reconnect_attempts += 1
                self.reconnect_attempts = reconnect_attempts
                backoff = min(60, 2 ** reconnect_attempts)
                self._runtime_health(
                    status="yellow" if reconnect_attempts < 6 else "red",
                    summary=f"Riconnessione WebSocket ({reconnect_attempts})",
                    websocket_connected=False,
                    reconnect_attempts=reconnect_attempts,
                )
                if reconnect_attempts >= 6:
                    self._auto_pause("Troppi tentativi di riconnessione WebSocket")
                    break
                self._log(f"🔄 Auto-Reconnect WebSocket tra {backoff} secondi... (Tentativo {reconnect_attempts})")
                time.sleep(backoff)

    def loop(self):
        """Questo è il punto di ingresso chiamato dal main thread (api.py)"""
        try:
            self.running = True
            uid = getattr(self, 'user_id', 'admin')
            self._runtime_health(
                persist=True,
                status="yellow",
                summary="Avvio motore trading",
                websocket_connected=False,
                auto_paused=False,
                auto_pause_reason=None,
                last_error=None,
                sync_failures=0,
                reconnect_attempts=0,
            )
            self.init_clients(uid)
            
            if not self.alpaca_rest:
                self._log("Mancano chiavi Alpaca valide. Il modulo si ferma.")
                self._auto_pause("Chiavi Alpaca mancanti o non valide")
                return
                
            self.prefill_history()

            risk = get_risk_manager(self.bot_state.virtual_cash)
            can_trade, reason = risk.can_trade()
            if not can_trade:
                self._log(f"⛔ {reason}")
                self._runtime_health(
                    persist=True,
                    status="red",
                    summary=reason,
                    auto_paused=True,
                    auto_pause_reason=reason,
                )
                self.running = False
                return
                
            # Avvia stream in un nuovo thread per non bloccare il loop
            self._stream_thread = threading.Thread(target=self._stream_runner, daemon=True)
            self._stream_thread.start()
            
            # Loop di keep-alive e sync
            while self.running and self.bot_state.modules.get("trading", False):
                time.sleep(60)
                try:
                    self.sync_portfolio()
                    health_warnings = []
                    now_ts = time.time()
                    if self.last_bar_received_at and (now_ts - self.last_bar_received_at) > 900:
                        health_warnings.append("Feed dati fermo oltre soglia di sicurezza")
                    if self.sync_failures >= 2:
                        health_warnings.append(f"Sync portfolio instabile ({self.sync_failures})")
                    if health_warnings:
                        self._runtime_health(
                            status="yellow",
                            summary=health_warnings[0],
                            warnings=health_warnings,
                            reconnect_attempts=self.reconnect_attempts,
                            sync_failures=self.sync_failures,
                        )
                    else:
                        self._runtime_health(
                            status="green",
                            summary="Motore trading stabile",
                            warnings=[],
                            websocket_connected=True,
                            reconnect_attempts=self.reconnect_attempts,
                            sync_failures=self.sync_failures,
                        )
                    if self.last_bar_received_at and (now_ts - self.last_bar_received_at) > 1200:
                        self._auto_pause("Feed dati assente da oltre 20 minuti")
                        break
                except Exception:
                    if self.sync_failures >= 3:
                        self._auto_pause("Sync portfolio fallito ripetutamente")
                        break
                    
            # Chiusura
            self.running = False
            if self.alpaca_stream:
                self.alpaca_stream.stop()
            self._runtime_health(
                persist=True,
                websocket_connected=False,
                summary="Motore Alpaca fermato",
            )
            self._log("Motore Alpaca Fermato.")
        except Exception as e:
            self._log(f"💥 CRASH CRITICO nel motore Alpaca: {e}")
            self._auto_pause(f"Crash critico motore Alpaca: {e}")
