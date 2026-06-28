import os
import time
import asyncio
import datetime
import math
import alpaca_trade_api as tradeapi
import pandas as pd
import google.generativeai as genai

class AlpacaEngine:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.alpaca = None
        self.symbols = ["SPY", "QQQ", "AAPL", "MSFT", "TSLA", "NVDA"]
        self.llm_enabled = False
        
        self.init_clients()

    def init_clients(self):
        # Init Alpaca
        keys = {}
        try:
            with open(".env.keys", "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        keys[k] = v
        except Exception as e:
            pass
            
        alpaca_key = keys.get("ALPACA_KEY", os.getenv("ALPACA_API_KEY", ""))
        alpaca_secret = keys.get("ALPACA_SECRET", os.getenv("ALPACA_SECRET_KEY", ""))
        alpaca_base = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
        
        if alpaca_key and alpaca_secret:
            try:
                self.alpaca = tradeapi.REST(alpaca_key, alpaca_secret, alpaca_base, api_version='v2')
            except Exception as e:
                self._log(f"Errore connessione Alpaca: {e}")
                
        # Init Gemini
        gemini_key = keys.get("GEMINI_KEY", os.getenv("GEMINI_API_KEY", ""))
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.llm_enabled = True
        else:
            self._log("Avviso: GEMINI_KEY non trovata in .env.keys. Il bot userà solo la statistica.")

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.add_log(f"[{timestamp}] 📈 ALPACA: {message}")

    def get_llm_sentiment(self, symbol, news_headlines):
        if not self.llm_enabled or not news_headlines:
            return "NEUTRAL"
            
        prompt = f"Analizza il sentiment di queste notizie finanziarie recenti sul titolo {symbol}. Rispondi SOLO con una di queste tre parole: BULLISH, BEARISH, o NEUTRAL. Notizie:\n"
        for i, n in enumerate(news_headlines):
            prompt += f"- {n}\n"
            
        try:
            response = self.model.generate_content(prompt)
            result = response.text.strip().upper()
            if "BULLISH" in result: return "BULLISH"
            if "BEARISH" in result: return "BEARISH"
            return "NEUTRAL"
        except Exception as e:
            self._log(f"Errore Gemini API: {e}")
            return "NEUTRAL"

    def process_symbol(self, symbol):
        try:
            # 1. Data Ingestion (Statistica)
            bars = self.alpaca.get_bars(symbol, tradeapi.TimeFrame.Minute, limit=50).df
            if bars.empty or len(bars) < 20:
                return
                
            close_prices = bars['close']
            current_price = close_prices.iloc[-1]
            
            # Calcolo Indicatori Manuale (Pandas)
            # RSI
            delta = close_prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = (100 - (100 / (1 + rs))).iloc[-1]
            
            # Bollinger Bands
            rolling_mean = close_prices.rolling(window=20).mean()
            rolling_std = close_prices.rolling(window=20).std()
            bb_lower = (rolling_mean - (rolling_std * 2)).iloc[-1]
            bb_upper = (rolling_mean + (rolling_std * 2)).iloc[-1]
            
            # Self-update UI
            self.bot_state.latest_predictions[symbol] = f"RSI: {rsi:.1f} | BB_L: {bb_lower:.2f}"
            
            # 2. Check Entrata (Mean Reversion)
            if current_price < bb_lower and rsi < 30:
                self._log(f"⚡ SETUP RILEVATO su {symbol}: Prezzo {current_price:.2f} < BB_Lower ({bb_lower:.2f}) e RSI {rsi:.1f}")
                
                # 3. LLM News Sentiment Veto
                sentiment = "NEUTRAL"
                if self.llm_enabled:
                    news = self.alpaca.get_news(symbol, limit=3)
                    headlines = [n.headline for n in news]
                    sentiment = self.get_llm_sentiment(symbol, headlines)
                    
                if sentiment == "BEARISH":
                    self._log(f"🧠 AI VETO: Sentiment Bearish rilevato per {symbol} a causa di news negative. Acquisto annullato.")
                    return
                elif sentiment == "BULLISH":
                    self._log(f"🧠 AI BOOST: Sentiment Bullish per {symbol}. Condizioni ideali.")
                
                # 4. Esecuzione (Paper Trading Virtuale per ora)
                trade_amount = self.bot_state.virtual_cash * 0.1 # 10% del capitale per trade
                if trade_amount > 100:
                    qty = math.floor(trade_amount / current_price)
                    if qty > 0:
                        self._log(f"🛒 ESECUZIONE SIMULATA: BUY {qty} {symbol} @ {current_price:.2f}")
                        self.bot_state.virtual_cash -= (qty * current_price)
                        # Salva posizione in memoria locale per il trailing stop
                        if not hasattr(self, "virtual_positions"):
                            self.virtual_positions = {}
                        self.virtual_positions[symbol] = {
                            "qty": qty,
                            "entry_price": current_price,
                            "high_watermark": current_price
                        }
            
            # Check Trailing Stop Loss per posizioni aperte
            if hasattr(self, "virtual_positions") and symbol in self.virtual_positions:
                pos = self.virtual_positions[symbol]
                pos["high_watermark"] = max(pos["high_watermark"], current_price)
                
                # Trailing stop del 2% dal massimo storico, o take profit
                drop_pct = (pos["high_watermark"] - current_price) / pos["high_watermark"]
                profit_pct = (current_price - pos["entry_price"]) / pos["entry_price"]
                
                if drop_pct >= 0.02 or profit_pct >= 0.05 or (current_price > bb_upper):
                    profit_usd = (current_price - pos["entry_price"]) * pos["qty"]
                    self._log(f"💰 CHIUSURA SIMULATA: SELL {pos['qty']} {symbol} @ {current_price:.2f} | PnL: +${profit_usd:.2f}")
                    self.bot_state.virtual_cash += (pos["qty"] * current_price)
                    del self.virtual_positions[symbol]
                    
        except Exception as e:
            self._log(f"Errore su {symbol}: {e}")

    async def _trading_loop(self):
        self._log("Avvio Motore Alpaca Quantitativo + LLM (Gemini).")
        while self.running and self.bot_state.modules.get("trading", False):
            if not self.alpaca:
                self._log("Alpaca non inizializzata. Ritento tra 30s...")
                await asyncio.sleep(30)
                self.init_clients()
                continue
                
            try:
                clock = self.alpaca.get_clock()
                if not clock.is_open:
                    self._log("Mercato USA Chiuso. In attesa...")
                    await asyncio.sleep(60 * 5) # Check every 5 mins
                    continue
            except Exception as e:
                self._log(f"Errore controllo orario mercato: {e}")
                await asyncio.sleep(60)
                continue
                
            for symbol in self.symbols:
                if not self.running or not self.bot_state.modules.get("trading", False):
                    break
                self.process_symbol(symbol)
                await asyncio.sleep(5) # Rate limiting
                
            await asyncio.sleep(30) # Loop ogni 30 secondi
            
        self._log("Motore Alpaca Fermato.")

    def loop(self):
        self.running = True
        try:
            asyncio.run(self._trading_loop())
        except Exception as e:
            self._log(f"Errore critico: {e}")
        finally:
            self.running = False
