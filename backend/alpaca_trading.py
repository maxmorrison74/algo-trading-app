import os
import time
import asyncio
import datetime
import threading
import pandas as pd
from groq import Groq
import alpaca_trade_api as tradeapi
from alpaca_trade_api.stream import Stream
from lstm_model import LSTMTradingModel

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
                
        # Init Gemini
        groq_key = keys.get("GROQ_KEY", os.getenv("GROQ_API_KEY", ""))
        if groq_key:
            self.model = Groq(api_key=groq_key)
            self.llm_enabled = True
            self._log("Modulo AI Sentiment basato su notizie in tempo reale abilitato (Groq LLaMA3).")
        else:
            self._log("Avviso: GROQ_KEY non trovata. Trading solo su Analisi Tecnica e LSTM.")
            
        # Carica modelli LSTM
        models_dir = os.path.join(os.path.dirname(__file__), "models")
        if os.path.exists(models_dir):
            for sym in self.symbols:
                model_path = os.path.join(models_dir, f"{sym}_model.keras")
                fallback_path = os.path.join(models_dir, "SUPER_MODEL.keras")
                target_path = model_path if os.path.exists(model_path) else fallback_path
                if os.path.exists(target_path):
                    try:
                        self.ml_models[sym] = LSTMTradingModel()
                        self.ml_models[sym].load(target_path)
                        self._log(f"🧠 Modello LSTM caricato per {sym} da {os.path.basename(target_path)}")
                    except Exception as e:
                        self._log(f"⚠️ Errore caricamento LSTM per {sym}: {e}")

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

    def clean_sym(self, sym):
        # Le API Alpaca (incluso get_bars) per le criptovalute richiedono BTCUSD e non BTC/USD
        if "/" in sym:
            return sym.replace("/", "")
        return sym

    def prefill_history(self):
        """Pre-carica 50 candele storiche per ogni simbolo per calcolare RSI/BB subito"""
        if not self.alpaca_rest: return
        self._log("Pre-caricamento storico candele (REST)...")
        for sym in self.symbols:
            try:
                query_sym = self.clean_sym(sym)
                bars = self.alpaca_rest.get_bars(query_sym, tradeapi.TimeFrame.Minute, limit=150).df
                if not bars.empty:
                    self.history_buffers[sym] = bars
                    # Calcola subito la predizione iniziale ad ogni avvio!
                    self.evaluate_strategy(sym, bars)
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
            
        # 🤖 Predizione LSTM Quantitativa
        lstm_prob = 0.5
        if symbol in self.ml_models:
            try:
                lstm_prob = self.ml_models[symbol].predict_realtime(df)
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
            
        self.bot_state.latest_predictions[symbol] = f"LSTM: {lstm_prob*100:.1f}% | RSI(1M): {rsi:.1f} | RSI(5M): {macro_rsi:.1f} | BB_L: {bb_lower:.2f}"
        
        # Check Long (Mean Reversion O Breakout Momentum)
        # Strategia 1: Crollo Ipervenduto (Mean Reversion)
        is_mean_reversion_long = (current_price < bb_lower and rsi < 35)
        # Strategia 2: Breakout al rialzo (Momentum)
        is_momentum_long = (current_price > bb_upper and rsi > 60 and macro_rsi > 50)
        
        if is_mean_reversion_long or is_momentum_long:
            if macro_rsi < 35:
                self._log(f"⚠️ MACRO VETO: Il trend a 5 minuti ({macro_rsi:.1f}) è troppo ipervenduto. Long annullato.")
            elif lstm_prob > 0.65: # Richiedi almeno il 65% di probabilità UP dalla rete neurale
                pattern = self.predict_pattern_with_groq(symbol, close_prices)
                if pattern == "UP":
                    strategy_name = "MOMENTUM BREAKOUT" if is_momentum_long else "MEAN REVERSION"
                    self._log(f"🔥 STRATEGIA {strategy_name} ATTIVATA su {symbol}")
                    self.execute_trade(symbol, current_price, "LONG", atr)
                else:
                    self._log(f"🧠 AI VETO PREDICTIVE: Setup LONG su {symbol} confermato da LSTM, ma Groq NLP prevede DOWN. Annullato.")
            else:
                 self._log(f"🤖 LSTM VETO: Setup LONG su {symbol} (Prob={lstm_prob*100:.1f}%) non sufficiente (richiesto > 65%).")
            
        # Check Short (Mean Reversion dall'alto + LSTM Confluence + Macro Trend)
        elif current_price > bb_upper and rsi > 70 and lstm_prob < 0.35: # Probabilità UP bassa significa probabilità DOWN alta
            if macro_rsi > 65:
                self._log(f"⚠️ MACRO VETO: Il trend a 5 minuti ({macro_rsi:.1f}) è troppo forte al rialzo. Short annullato.")
            else:
                pattern = self.predict_pattern_with_groq(symbol, close_prices)
                if pattern == "DOWN":
                    self.execute_trade(symbol, current_price, "SHORT", atr)
                else:
                    self._log(f"🧠 AI VETO PREDICTIVE: Setup SHORT su {symbol} confermato da LSTM, ma Groq NLP prevede UP. Annullato.")

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

    def execute_trade(self, symbol, current_price, side, atr):
        self._log(f"⚡ SETUP {side} RILEVATO su {symbol}: Prezzo {current_price:.2f} (ATR: {atr:.2f})")
        
        if side == "SHORT" and not self.is_shortable(symbol):
            self._log(f"⚠️ SKIP SHORT su {symbol}: L'asset non è shortabile su Alpaca. Operazione annullata.")
            return
            
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
        
        # Position Sizing Dinamico basato su confidenza (Approccio MASSIMO GUADAGNO per Micro-Conti)
        if self.bot_state.virtual_cash < 500:
            # LEVA 2x: Moltiplichiamo il moltiplicatore base per 2 usando il Margin Power di Alpaca
            leverage_multiplier = 2.0 
            
            # Rischio Aggressivo: Usiamo dal 50% al 98% del capitale * 2x di leva = fino al 200%
            size_multiplier = 0.50 * leverage_multiplier
            if confidence == 4:
                size_multiplier = 0.75 * leverage_multiplier
            elif confidence == 5:
                size_multiplier = 0.98 * leverage_multiplier # 196% esposizione max
        else:
            # Per conti grossi restiamo conservativi
            size_multiplier = 0.05
            if confidence == 4:
                size_multiplier = 0.10
            elif confidence == 5:
                size_multiplier = 0.15
            
        trade_amount = self.bot_state.virtual_cash * size_multiplier
        if trade_amount < 10: # Abbassato il blocco da 100$ a 10$
            return
            
        # Azioni Frazionate: calcoliamo il valore con decimali invece di intero
        qty = round(trade_amount / current_price, 4)
        if qty <= 0.0001: return
        
        # Trailing Stop Elastico (Più largo per assorbire volatilità e fare Max Profit)
        trail_percent = round((2.5 * atr) / current_price * 100, 2)
        trail_percent = max(0.5, min(trail_percent, 3.5)) # Trailing Stop compreso tra 0.5% e 3.5%
        
        alpaca_side = 'buy' if side == "LONG" else 'sell'
        exit_side = 'sell' if side == "LONG" else 'buy'
        
        try:
            # 1. Invia Ordine di Entrata (Market)
            entry = self.alpaca_rest.submit_order(
                symbol=symbol,
                qty=qty,
                side=alpaca_side,
                type='market',
                time_in_force='day'
            )
            
            # 2. Invia Ordine Trailing Stop per l'Uscita (Lascia correre i profitti!)
            self.alpaca_rest.submit_order(
                symbol=symbol,
                qty=qty,
                side=exit_side,
                type='trailing_stop',
                trail_percent=trail_percent,
                time_in_force='day'
            )
            self._log(f"🚀 ORDINE REALE {side} {qty} {symbol} INVIATO AD ALPACA (Trailing Stop: {trail_percent}% | Taglia: {size_multiplier*100:.0f}%)")
        except Exception as e:
            self._log(f"❌ ERRORE INVIO ORDINE: {e}")

    def _stream_runner(self):
        stock_symbols = [s for s in self.symbols if "/" not in s]
        self.alpaca_stream = Stream(self.alpaca_key, self.alpaca_secret, base_url=self.alpaca_base, data_feed='iex')
        if stock_symbols:
            self.alpaca_stream.subscribe_bars(self.on_bar, *stock_symbols)
        try:
            self._log("📡 WebSocket Connesso: in attesa di stream tick-by-tick...")
            if stock_symbols:
                self.alpaca_stream.run()
            else:
                self._log("Avviso: Nessun asset azionario da ascoltare via WebSocket.")
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
            
            # Polling REST per tenere aggiornati i segnali di tutti i simboli (Crypto inclusi)
            for sym in self.symbols:
                try:
                    query_sym = self.clean_sym(sym)
                    bars = self.alpaca_rest.get_bars(query_sym, tradeapi.TimeFrame.Minute, limit=150).df
                    if not bars.empty:
                        self.history_buffers[sym] = bars
                        self.evaluate_strategy(sym, bars)
                except Exception:
                    pass
            
        # Chiusura
        self.running = False
        if self.alpaca_stream:
            self.alpaca_stream.stop()
        self._log("Motore Alpaca Fermato.")
