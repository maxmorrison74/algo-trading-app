import asyncio
import json
import datetime
import websockets
import time

class CryptoArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        
        # In-memory fast state for pricing
        self.prices = {
            "binance": {"bid": 0.0, "ask": 0.0},
            "kraken": {"bid": 0.0, "ask": 0.0}
        }
        
        if not hasattr(self.bot_state, "arb_logs"):
            self.bot_state.arb_logs = []
        if not hasattr(self.bot_state, "arb_prices"):
            self.bot_state.arb_prices = {"binance": 0, "kraken": 0}
            
        self.last_execution_time = 0

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        self.bot_state.arb_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.arb_logs) > 50:
            self.bot_state.arb_logs.pop()

    async def connect_binance(self):
        uri = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker"
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                async with websockets.connect(uri) as ws:
                    self._log("Binance WebSocket Connesso (BTC/USDT).")
                    while self.running and self.bot_state.modules.get("crypto_arb", False):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(message)
                        # data format: {"b": "bid_price", "a": "ask_price"}
                        if 'b' in data and 'a' in data:
                            self.prices["binance"]["bid"] = float(data['b'])
                            self.prices["binance"]["ask"] = float(data['a'])
                            self.bot_state.arb_prices["binance"] = float(data['a']) # UI update
                            self.check_arbitrage()
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Binance WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)
            
    async def connect_kraken(self):
        uri = "wss://ws.kraken.com"
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                async with websockets.connect(uri) as ws:
                    self._log("Kraken WebSocket Connesso (XBT/USD).")
                    subscribe_msg = {
                        "event": "subscribe",
                        "pair": ["XBT/USD"],
                        "subscription": {"name": "ticker"}
                    }
                    await ws.send(json.dumps(subscribe_msg))
                    
                    while self.running and self.bot_state.modules.get("crypto_arb", False):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(message)
                        
                        # Kraken ticker format is a list where index 1 is a dict with 'b' and 'a'
                        if isinstance(data, list) and len(data) > 1 and isinstance(data[1], dict):
                            ticker = data[1]
                            if 'b' in ticker and 'a' in ticker:
                                self.prices["kraken"]["bid"] = float(ticker['b'][0])
                                self.prices["kraken"]["ask"] = float(ticker['a'][0])
                                self.bot_state.arb_prices["kraken"] = float(ticker['a'][0]) # UI update
                                self.check_arbitrage()
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Kraken WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)

    def check_arbitrage(self):
        # We need both prices initialized
        b_bid = self.prices["binance"]["bid"]
        b_ask = self.prices["binance"]["ask"]
        k_bid = self.prices["kraken"]["bid"]
        k_ask = self.prices["kraken"]["ask"]
        
        if b_bid == 0 or k_bid == 0:
            return
            
        current_time = time.time()
        if current_time - self.last_execution_time < 1.0:
            return # Cooldown to prevent spam in simulation
            
        fee_threshold = 0.0005 # 0.05% for paper trading frequency
        trade_qty = 0.5 # BTC
        
        # Case 1: Buy on Kraken, Sell on Binance
        spread1 = b_bid - k_ask
        profit1_perc = (spread1 / k_ask) * 100
        
        # Case 2: Buy on Binance, Sell on Kraken
        spread2 = k_bid - b_ask
        profit2_perc = (spread2 / b_ask) * 100
        
        executed = False
        if profit1_perc > fee_threshold:
            profit_usd = spread1 * trade_qty
            self._log(f"⚡ ESECUZIONE (SIM): BUY Kraken @ {k_ask:.2f} | SELL Binance @ {b_bid:.2f} | PnL: +${profit_usd:.2f} | Spread: {profit1_perc:.3f}%")
            self.bot_state.virtual_cash += profit_usd
            self.last_execution_time = current_time
            executed = True
            
        elif profit2_perc > fee_threshold:
            profit_usd = spread2 * trade_qty
            self._log(f"⚡ ESECUZIONE (SIM): BUY Binance @ {b_ask:.2f} | SELL Kraken @ {k_bid:.2f} | PnL: +${profit_usd:.2f} | Spread: {profit2_perc:.3f}%")
            self.bot_state.virtual_cash += profit_usd
            self.last_execution_time = current_time
            executed = True

    async def _arb_loop(self):
        self._log("Avvio Motore DeFi Arbitrage (WebSocket Engine)...")
        # Start both WebSocket listeners concurrently
        await asyncio.gather(
            self.connect_binance(),
            self.connect_kraken()
        )
        self._log("Motore DeFi Arbitrage fermato.")

    def loop(self):
        self.running = True
        try:
            # Create a new event loop for this thread
            asyncio.run(self._arb_loop())
        except Exception as e:
            self._log(f"Errore critico motore: {str(e)}")
        finally:
            self.running = False
