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

    def get_llm_sentiment(self, symbol):
        if not self.llm_enabled:
            return "NEUTRAL"
            
        try:
            news = self.alpaca_rest.get_news(symbol, limit=3)
            headlines = [n.headline for n in news]
            if not headlines:
                return "NEUTRAL"
                
            prompt = f"Analizza il sentiment di queste notizie finanziarie su {symbol}. Rispondi SOLO con BULLISH, BEARISH, o NEUTRAL.\nNotizie:\n"
            for n in headlines:
                prompt += f"- {n}\n"
                
            response = self.model.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant"
            )
            result = response.choices[0].message.content.strip().upper()
            if "BULLISH" in result: return "BULLISH"
            if "BEARISH" in result: return "BEARISH"
            return "NEUTRAL"
        except Exception as e:
            self._log(f"Errore Groq API: {e}")
            return "NEUTRAL"

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
        
        self.bot_state.latest_predictions[symbol] = f"RSI: {rsi:.1f} | BB_L: {bb_lower:.2f} | BB_U: {bb_upper:.2f}"
        
        # Check Long (Mean Reversion dal basso)
        if current_price < bb_lower and rsi < 30:
            self.execute_trade(symbol, current_price, "LONG")
            
        # Check Short (Mean Reversion dall'alto)
        elif current_price > bb_upper and rsi > 70:
            self.execute_trade(symbol, current_price, "SHORT")

    def execute_trade(self, symbol, current_price, side):
        self._log(f"⚡ SETUP {side} RILEVATO su {symbol}: Prezzo {current_price:.2f}")
        
        sentiment = self.get_llm_sentiment(symbol)
        
        if side == "LONG" and sentiment == "BEARISH":
            self._log(f"🧠 AI VETO: Sentiment Bearish per {symbol}. Long annullato.")
            return
        elif side == "SHORT" and sentiment == "BULLISH":
            self._log(f"🧠 AI VETO: Sentiment Bullish per {symbol}. Short annullato.")
            return
            
        self._log(f"🧠 AI CONFERMA: Sentiment = {sentiment}. Esecuzione Ordine!")
        
        # Sincronizza per sicurezza
        self.sync_portfolio()
        
        trade_amount = self.bot_state.virtual_cash * 0.1 # 10% del capitale
        if trade_amount < 100:
            return
            
        qty = int(trade_amount // current_price)
        if qty <= 0: return
        
        # Bracket Order parameters
        take_profit_price = current_price * 1.05 if side == "LONG" else current_price * 0.95
        stop_loss_price = current_price * 0.98 if side == "LONG" else current_price * 1.02
        
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
            self._log(f"🚀 ORDINE REALE {side} {qty} {symbol} INVIATO AD ALPACA (TP: {take_profit_price:.2f}, SL: {stop_loss_price:.2f})")
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
