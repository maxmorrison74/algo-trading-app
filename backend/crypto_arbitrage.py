import asyncio
import json
import datetime
import websockets
import time

class CryptoArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        
        # Mapping symbols to internal format
        self.pairs = ["BTC", "ETH", "SOL", "XRP"]
        
        self.binance_symbols = {
            "btcusdt": "BTC",
            "ethusdt": "ETH",
            "solusdt": "SOL",
            "xrpusdt": "XRP"
        }
        
        self.kraken_symbols = {
            "XBT/USD": "BTC",
            "ETH/USD": "ETH",
            "SOL/USD": "SOL",
            "XRP/USD": "XRP"
        }

        # Trade quantities per pair to keep PnL proportional
        self.trade_qty = {
            "BTC": 0.5,    # 0.5 BTC
            "ETH": 10.0,   # 10 ETH
            "SOL": 200.0,  # 200 SOL
            "XRP": 10000.0 # 10000 XRP
        }

        # In-memory fast state for pricing for multiple pairs
        self.prices = {
            pair: {
                "binance": {"bid": 0.0, "ask": 0.0},
                "kraken": {"bid": 0.0, "ask": 0.0}
            }
            for pair in self.pairs
        }
        
        if not hasattr(self.bot_state, "arb_logs"):
            self.bot_state.arb_logs = []
        if not hasattr(self.bot_state, "arb_prices"):
            # Update UI just for BTC for retrocompatibility if needed, but we'll show BTC here
            self.bot_state.arb_prices = {"binance": 0, "kraken": 0}
            
        self.last_execution_time = {pair: 0 for pair in self.pairs}

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        self.bot_state.arb_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.arb_logs) > 50:
            self.bot_state.arb_logs.pop()

    async def connect_binance(self):
        streams = "/".join([f"{sym}@bookTicker" for sym in self.binance_symbols.keys()])
        uri = f"wss://stream.binance.com:9443/stream?streams={streams}"
        
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                async with websockets.connect(uri) as ws:
                    self._log(f"Binance WebSocket Connesso ({', '.join(self.pairs)}).")
                    while self.running and self.bot_state.modules.get("crypto_arb", False):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        payload = json.loads(message)
                        
                        if 'stream' in payload and 'data' in payload:
                            stream_name = payload['stream'].split('@')[0]
                            data = payload['data']
                            pair = self.binance_symbols.get(stream_name)
                            
                            if pair and 'b' in data and 'a' in data:
                                self.prices[pair]["binance"]["bid"] = float(data['b'])
                                self.prices[pair]["binance"]["ask"] = float(data['a'])
                                
                                if pair == "BTC":
                                    self.bot_state.arb_prices["binance"] = float(data['a'])
                                    
                                self.check_arbitrage(pair)
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Binance WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)
            
    async def connect_kraken(self):
        uri = "wss://ws.kraken.com"
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                async with websockets.connect(uri) as ws:
                    self._log(f"Kraken WebSocket Connesso ({', '.join(self.pairs)}).")
                    subscribe_msg = {
                        "event": "subscribe",
                        "pair": list(self.kraken_symbols.keys()),
                        "subscription": {"name": "ticker"}
                    }
                    await ws.send(json.dumps(subscribe_msg))
                    
                    while self.running and self.bot_state.modules.get("crypto_arb", False):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(message)
                        
                        if isinstance(data, list) and len(data) > 3:
                            # Ticker data: [channelID, {"a": [...], "b": [...]}, "ticker", "XBT/USD"]
                            ticker = data[1]
                            pair_kraken = data[3]
                            pair = self.kraken_symbols.get(pair_kraken)
                            
                            if pair and 'b' in ticker and 'a' in ticker:
                                self.prices[pair]["kraken"]["bid"] = float(ticker['b'][0])
                                self.prices[pair]["kraken"]["ask"] = float(ticker['a'][0])
                                
                                if pair == "BTC":
                                    self.bot_state.arb_prices["kraken"] = float(ticker['a'][0])
                                    
                                self.check_arbitrage(pair)
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Kraken WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)

    def check_arbitrage(self, pair):
        b_bid = self.prices[pair]["binance"]["bid"]
        b_ask = self.prices[pair]["binance"]["ask"]
        k_bid = self.prices[pair]["kraken"]["bid"]
        k_ask = self.prices[pair]["kraken"]["ask"]
        
        if b_bid == 0 or k_bid == 0:
            return
            
        current_time = time.time()
        if current_time - self.last_execution_time[pair] < 1.0:
            return # Cooldown per pair per evitare spam
            
        fee_threshold = 0.0005 # 0.05%
        qty = self.trade_qty[pair]
        
        # Case 1: Buy on Kraken, Sell on Binance
        spread1 = b_bid - k_ask
        profit1_perc = (spread1 / k_ask) * 100
        
        # Case 2: Buy on Binance, Sell on Kraken
        spread2 = k_bid - b_ask
        profit2_perc = (spread2 / b_ask) * 100
        
        if profit1_perc > fee_threshold:
            profit_usd = spread1 * qty
            self._log(f"⚡ {pair} ESEC (SIM): BUY Kraken @ {k_ask:.3f} | SELL Bin @ {b_bid:.3f} | PnL: +${profit_usd:.2f} | Spread: {profit1_perc:.3f}%")
            self.bot_state.virtual_cash += profit_usd
            self.last_execution_time[pair] = current_time
            
        elif profit2_perc > fee_threshold:
            profit_usd = spread2 * qty
            self._log(f"⚡ {pair} ESEC (SIM): BUY Bin @ {b_ask:.3f} | SELL Kraken @ {k_bid:.3f} | PnL: +${profit_usd:.2f} | Spread: {profit2_perc:.3f}%")
            self.bot_state.virtual_cash += profit_usd
            self.last_execution_time[pair] = current_time

    async def _arb_loop(self):
        self._log("🚀 Avvio Motore Multi-Coin DeFi (BTC, ETH, SOL, XRP)...")
        await asyncio.gather(
            self.connect_binance(),
            self.connect_kraken()
        )
        self._log("Motore DeFi Arbitrage fermato.")

    def loop(self):
        self.running = True
        try:
            asyncio.run(self._arb_loop())
        except Exception as e:
            self._log(f"Errore critico motore: {str(e)}")
        finally:
            self.running = False
