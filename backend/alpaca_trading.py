import os
import time
import asyncio
import datetime
import threading
import pandas as pd
from groq import Groq
import alpaca_trade_api as tradeapi
from alpaca_trade_api.stream import Stream

class AlpacaEngine:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.alpaca_rest = None
        self.alpaca_stream = None
        self.symbols = ["SPY", "QQQ", "AAPL", "MSFT", "TSLA", "NVDA"]
        self.llm_enabled = False
        self.history_buffers = {sym: pd.DataFrame() for sym in self.symbols}
        
        # Start async loop thread for streaming
        self._stream_thread = None

    def init_clients(self):
        # Init Alpaca
        keys = {}
        try:
            keys_file = os.path.join(os.path.dirname(__file__), ".env.keys")
            with open(keys_file, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        keys[k] = v
        except Exception:
            pass
            
        self.alpaca_key = keys.get("ALPACA_KEY", os.getenv("ALPACA_API_KEY", ""))
        self.alpaca_secret = keys.get("ALPACA_SECRET", os.getenv("ALPACA_SECRET_KEY", ""))
        self.alpaca_base = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
        
        if self.alpaca_key and self.alpaca_secret:
            try:
                self.alpaca_rest = tradeapi.REST(self.alpaca_key, self.alpaca_secret, self.alpaca_base, api_version='v2')
                self.sync_portfolio()
            except Exception as e:
                self._log(f"❌ ERRORE: Chiavi Alpaca rifiutate. Le API Keys correnti in memoria non funzionano: {e}")
                self.alpaca_rest = None
                self.running = False
                self.bot_state.modules["trading"] = False
                
        # Init Gemini
        groq_key = keys.get("GROQ_KEY", os.getenv("GROQ_API_KEY", ""))
        if groq_key:
            self.model = Groq(api_key=groq_key)
            self.llm_enabled = True
            self._log("Modulo AI Sentiment basato su notizie in tempo reale abilitato (Groq LLaMA3).")
        else:
            self._log("Avviso: GROQ_KEY non trovata. Trading solo su Analisi Tecnica.")

    def sync_portfolio(self):
        try:
            account = self.alpaca_rest.get_account()
            self.bot_state.virtual_cash = float(account.portfolio_value)
            # Potremmo anche listare le posizioni reali qui se servisse aggiornare UI
        except Exception as e:
            self._log(f"❌ ERRORE: Chiavi Alpaca non valide o account non autorizzato. {e}")
            raise e

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.add_log(f"[{timestamp}] 📈 ALPACA: {message}")

    def predict_pattern_with_groq(self, symbol, close_prices):
        if not self.llm_enabled:
            return "UP"
            
        try:
            import json
            prices_str = ", ".join([f"{p:.2f}" for p in close_prices.tail(30)])
            prompt = (
                f"Agisci come un analista quantitativo di time-series. Analizza questa sequenza di prezzi di chiusura recenti (dal meno recente al più recente) per {symbol}:\n"
                f"[{prices_str}]\n\n"
                f"Predici se la prossima chiusura sarà maggiore (UP) o minore (DOWN) del prezzo corrente ({close_prices.iloc[-1]:.2f}).\n"
                f"Rispondi rigidamente in formato JSON con questo schema:\n"
                f"{{\n  \"prediction\": \"UP\" | \"DOWN\",\n  \"confidence\": 1,\n  \"reason\": \"spiegazione tecnica\"\n}}"
            )
            response = self.model.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"}
            )
            data = json.loads(response.choices[0].message.content)
            prediction = data.get("prediction", "UP").strip().upper()
            self._log(f"🧠 AI Predictor per {symbol}: {prediction} (Confidenza: {data.get('confidence')}/5) - {data.get('reason')}")
            return prediction
        except Exception as e:
            self._log(f"Errore Groq Pattern Predictor per {symbol}: {e}")
            return "UP"

    def get_llm_sentiment_with_confidence(self, symbol):
        if not self.llm_enabled:
            return "NEUTRAL", 3
            
        try:
            import json
            news = self.alpaca_rest.get_news(symbol, limit=6)
            headlines = [n.headline for n in news]
            if not headlines:
                return "NEUTRAL", 3
                
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
                
            response = self.model.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"}
            )
            data = json.loads(response.choices[0].message.content)
            sentiment = data.get("sentiment", "NEUTRAL").strip().upper()
            confidence = int(data.get("confidence", 3))
            self._log(f"🧠 AI Sentiment per {symbol}: {sentiment} (Confidenza: {confidence}/5) - {data.get('reason')}")
            return sentiment, confidence
        except Exception as e:
            self._log(f"Errore Groq Sentiment API: {e}")
            return "NEUTRAL", 3

    def prefill_history(self):
        """Pre-carica 50 candele storiche per ogni simbolo per calcolare RSI/BB subito"""
        if not self.alpaca_rest: return
        self._log("Pre-caricamento storico candele (REST)...")
        for sym in self.symbols:
            try:
                bars = self.alpaca_rest.get_bars(sym, tradeapi.TimeFrame.Minute, limit=50).df
                if not bars.empty:
                    self.history_buffers[sym] = bars
            except Exception as e:
                self._log(f"Errore history {sym}: {e}")

    async def on_bar(self, bar):
        sym = bar.symbol
        if sym not in self.symbols: return
        
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
        # Mantieni solo le ultime 50 candele per non ingolfare la memoria
        df = df.tail(50)
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

        self.bot_state.latest_predictions[symbol] = f"RSI: {rsi:.1f} | BB_L: {bb_lower:.2f} | BB_U: {bb_upper:.2f} | ATR: {atr:.2f}"
        
        # Check Long (Mean Reversion dal basso)
        if current_price < bb_lower and rsi < 30:
            pattern = self.predict_pattern_with_groq(symbol, close_prices)
            if pattern == "UP":
                self.execute_trade(symbol, current_price, "LONG", atr)
            else:
                self._log(f"🧠 AI VETO PREDICTIVE: Setup LONG su {symbol}, ma Groq prevede DOWN. Annullato.")
            
        # Check Short (Mean Reversion dall'alto)
        elif current_price > bb_upper and rsi > 70:
            pattern = self.predict_pattern_with_groq(symbol, close_prices)
            if pattern == "DOWN":
                self.execute_trade(symbol, current_price, "SHORT", atr)
            else:
                self._log(f"🧠 AI VETO PREDICTIVE: Setup SHORT su {symbol}, ma Groq prevede UP. Annullato.")

    def execute_trade(self, symbol, current_price, side, atr):
        self._log(f"⚡ SETUP {side} RILEVATO su {symbol}: Prezzo {current_price:.2f} (ATR: {atr:.2f})")
        
        sentiment, confidence = self.get_llm_sentiment_with_confidence(symbol)
        
        # Veto basato su sentiment
        if side == "LONG" and sentiment == "BEARISH":
            self._log(f"🧠 AI VETO: Sentiment Bearish per {symbol}. Long annullato.")
            return
        elif side == "SHORT" and sentiment == "BULLISH":
            self._log(f"🧠 AI VETO: Sentiment Bullish per {symbol}. Short annullato.")
            return
            
        # Veto basato su bassa confidenza (1 o 2)
        if confidence <= 2:
            self._log(f"🧠 AI VETO: Confidenza Groq troppo bassa ({confidence}/5). Operazione annullata per ridurre il rischio.")
            return
            
        self._log(f"🧠 AI CONFERMA: Sentiment = {sentiment} (Confidenza: {confidence}/5). Esecuzione Ordine!")
        
        # Sincronizza per sicurezza
        self.sync_portfolio()
        
        # Position Sizing Dinamico basato su confidenza
        size_multiplier = 0.05
        if confidence == 4:
            size_multiplier = 0.10
        elif confidence == 5:
            size_multiplier = 0.15
            
        trade_amount = self.bot_state.virtual_cash * size_multiplier
        if trade_amount < 100:
            return
            
        qty = int(trade_amount // current_price)
        if qty <= 0: return
        
        # Bracket Order parameters dinamici con ATR
        if side == "LONG":
            take_profit_price = current_price + (3.0 * atr)
            stop_loss_price = current_price - (1.5 * atr)
        else:
            take_profit_price = current_price - (3.0 * atr)
            stop_loss_price = current_price + (1.5 * atr)
        
        # Clamp di sicurezza per evitare stop/profit impossibili
        take_profit_price = max(0.01, take_profit_price)
        stop_loss_price = max(0.01, stop_loss_price)
        
        alpaca_side = 'buy' if side == "LONG" else 'sell'
        
        try:
            self.alpaca_rest.submit_order(
                symbol=symbol,
                qty=qty,
                side=alpaca_side,
                type='market',
                time_in_force='day',
                order_class='bracket',
                take_profit={'limit_price': round(take_profit_price, 2)},
                stop_loss={'stop_price': round(stop_loss_price, 2), 'limit_price': round(stop_loss_price, 2)}
            )
            self._log(f"🚀 ORDINE REALE {side} {qty} {symbol} INVIATO AD ALPACA (TP: {take_profit_price:.2f}, SL: {stop_loss_price:.2f} | Taglia: {size_multiplier*100:.0f}%)")
        except Exception as e:
            self._log(f"❌ ERRORE INVIO ORDINE: {e}")

    def _stream_runner(self):
        self.alpaca_stream = Stream(self.alpaca_key, self.alpaca_secret, base_url=self.alpaca_base, data_feed='iex')
        self.alpaca_stream.subscribe_bars(self.on_bar, *self.symbols)
        try:
            self._log("📡 WebSocket Connesso: in attesa di stream tick-by-tick...")
            self.alpaca_stream.run()
        except ValueError as ve:
            self.running = False
            self.bot_state.modules["trading"] = False
            if "auth failed" in str(ve).lower():
                self._log("❌ ERRORE: Chiavi Alpaca rifiutate dal server. Controlla le impostazioni!")
            else:
                self._log(f"❌ WebSocket errore: {ve}")
        except Exception as e:
            if self.running:
                self.running = False
                self.bot_state.modules["trading"] = False
                self._log(f"❌ WebSocket disconnesso: {e}")

    def loop(self):
        """Questo è il punto di ingresso chiamato dal main thread (api.py)"""
        self.running = True
        self.init_clients()
        
        if not self.alpaca_rest:
            self._log("Mancano chiavi Alpaca valide. Il modulo si ferma.")
            self.running = False
            return
            
        self.prefill_history()
        
        # Avvia stream in un nuovo thread per non bloccare il loop
        self._stream_thread = threading.Thread(target=self._stream_runner, daemon=True)
        self._stream_thread.start()
        
        # Loop di keep-alive e sync
        while self.running and self.bot_state.modules.get("trading", False):
            time.sleep(60)
            self.sync_portfolio() # Sincronizza bilancio ogni minuto per aggiornare la UI
            
        # Chiusura
        self.running = False
        if self.alpaca_stream:
            self.alpaca_stream.stop()
        self._log("Motore Alpaca Fermato.")
