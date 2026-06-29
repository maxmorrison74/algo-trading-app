import asyncio
import json
import datetime
import websockets
import time
import os
import ccxt.async_support as ccxt

class CryptoArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.paper_mode = True # OPZIONE C: Testnet/Paper mode attivo di default per sicurezza
        
        # Mapping symbols
        self.pairs = ["BTC", "ETH", "SOL", "XRP"]
        
        # CCXT Markets uses standard symbols like BTC/USDT
        self.ccxt_symbols = {
            "BTC": "BTC/USDT",
            "ETH": "ETH/USDT",
            "SOL": "SOL/USDT",
            "XRP": "XRP/USDT"
        }
        
        self.binance_streams = {
            "BTC": "btcusdt",
            "ETH": "ethusdt",
            "SOL": "solusdt",
            "XRP": "xrpusdt"
        }
        
        self.kraken_streams = {
            "BTC": "XBT/USD",
            "ETH": "ETH/USD",
            "SOL": "SOL/USD",
            "XRP": "XRP/USD"
        }

        # Size fissa per hedge (es. 0.01 BTC, 0.5 ETH)
        self.trade_qty = {
            "BTC": 0.01,
            "ETH": 0.5,
            "SOL": 10.0,
            "XRP": 500.0
        }

        # Pricing state
        self.prices = {
            pair: {
                "binance": {"bid": 0.0, "ask": 0.0},
                "kraken": {"bid": 0.0, "ask": 0.0}
            }
            for pair in self.pairs
        }
        
        # Taker fees (verranno sovrascritte da ccxt se disponibili)
        self.fees = {
            "binance": 0.001, # 0.1% Taker base
            "kraken": 0.0026  # 0.26% Taker base
        }
        
        if not hasattr(self.bot_state, "arb_logs"):
            self.bot_state.arb_logs = []
        if not hasattr(self.bot_state, "arb_prices"):
            self.bot_state.arb_prices = {"binance": 0, "kraken": 0}
            
        self.last_execution_time = {pair: 0 for pair in self.pairs}
        
        self.binance_client = None
        self.kraken_client = None

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        self.bot_state.arb_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.arb_logs) > 50:
            self.bot_state.arb_logs.pop()

    async def init_ccxt(self):
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
            
        b_key = keys.get("BINANCE_KEY", os.getenv("BINANCE_API_KEY", ""))
        b_secret = keys.get("BINANCE_SECRET", os.getenv("BINANCE_SECRET_KEY", ""))
        k_key = keys.get("KRAKEN_KEY", os.getenv("KRAKEN_API_KEY", ""))
        k_secret = keys.get("KRAKEN_SECRET", os.getenv("KRAKEN_SECRET_KEY", ""))
        
        self.binance_client = ccxt.binance({
            'apiKey': b_key,
            'secret': b_secret,
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })
        
        self.kraken_client = ccxt.kraken({
            'apiKey': k_key,
            'secret': k_secret,
            'enableRateLimit': True
        })
        
        # Carica i mercati per avere le fee precise
        try:
            self._log("Caricamento mercati e fees via CCXT...")
            await self.binance_client.load_markets()
            await self.kraken_client.load_markets()
            
            # Leggiamo la Taker fee per BTC/USDT come stima
            b_market = self.binance_client.market('BTC/USDT')
            if 'taker' in b_market and b_market['taker'] is not None:
                self.fees['binance'] = float(b_market['taker'])
                
            k_market = self.kraken_client.market('BTC/USD')
            if 'taker' in k_market and k_market['taker'] is not None:
                self.fees['kraken'] = float(k_market['taker'])
                
            self._log(f"Fees Taker impostate - Binance: {self.fees['binance']*100:.2f}%, Kraken: {self.fees['kraken']*100:.2f}%")
        except Exception as e:
            self._log(f"Avviso CCXT: Impossibile caricare fee reali, uso base. Errore: {e}")

    async def connect_binance(self):
        streams = "/".join([f"{v}@bookTicker" for v in self.binance_streams.values()])
        uri = f"wss://stream.binance.com:9443/stream?streams={streams}"
        
        # Invert map per lookup veloce
        stream_to_pair = {v: k for k, v in self.binance_streams.items()}
        
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
                            pair = stream_to_pair.get(stream_name)
                            
                            if pair and 'b' in data and 'a' in data:
                                self.prices[pair]["binance"]["bid"] = float(data['b'])
                                self.prices[pair]["binance"]["ask"] = float(data['a'])
                                
                                if pair == "BTC":
                                    self.bot_state.arb_prices["binance"] = float(data['a'])
                                    
                                await self.check_arbitrage(pair)
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Binance WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)
            
    async def connect_kraken(self):
        uri = "wss://ws.kraken.com"
        
        # Invert map
        stream_to_pair = {v: k for k, v in self.kraken_streams.items()}
        
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                async with websockets.connect(uri) as ws:
                    self._log(f"Kraken WebSocket Connesso ({', '.join(self.pairs)}).")
                    subscribe_msg = {
                        "event": "subscribe",
                        "pair": list(self.kraken_streams.values()),
                        "subscription": {"name": "ticker"}
                    }
                    await ws.send(json.dumps(subscribe_msg))
                    
                    while self.running and self.bot_state.modules.get("crypto_arb", False):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(message)
                        
                        if isinstance(data, list) and len(data) > 3:
                            ticker = data[1]
                            pair_kraken = data[3]
                            pair = stream_to_pair.get(pair_kraken)
                            
                            if pair and 'b' in ticker and 'a' in ticker:
                                self.prices[pair]["kraken"]["bid"] = float(ticker['b'][0])
                                self.prices[pair]["kraken"]["ask"] = float(ticker['a'][0])
                                
                                if pair == "BTC":
                                    self.bot_state.arb_prices["kraken"] = float(ticker['a'][0])
                                    
                                await self.check_arbitrage(pair)
            except Exception as e:
                if self.running and self.bot_state.modules.get("crypto_arb", False):
                    self._log(f"Errore Kraken WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)

    async def execute_hedging(self, pair, buy_exchange, sell_exchange, buy_price, sell_price, qty):
        # OPZIONE A: Ordini a mercato (Market) per non rischiare mancate esecuzioni.
        # Usa CCXT per sparare gli ordini simultaneamente.
        ccxt_sym = self.ccxt_symbols[pair]
        
        # Preparazione tasks
        tasks = []
        if buy_exchange == "binance":
            buy_task = self.binance_client.create_market_buy_order(ccxt_sym, qty)
            sell_task = self.kraken_client.create_market_sell_order(ccxt_sym, qty)
        else:
            buy_task = self.kraken_client.create_market_buy_order(ccxt_sym, qty)
            sell_task = self.binance_client.create_market_sell_order(ccxt_sym, qty)
            
        try:
            if self.paper_mode:
                # OPZIONE C: Paper Mode per evitare rischi su soldi veri in fase di test
                self._log(f"⚠️ PAPER HEDGE {pair}: BUY {buy_exchange} ({qty}), SELL {sell_exchange} ({qty})")
                await asyncio.sleep(0.5) # Simula latenza di rete
                # Sulla carta il bilancio virtuale sale
                spread_val = (sell_price - buy_price)
                fees = (buy_price * self.fees[buy_exchange]) + (sell_price * self.fees[sell_exchange])
                net_profit = (spread_val * qty) - (fees * qty)
                self.bot_state.virtual_cash += net_profit
                self._log(f"✅ PAPER HEDGE COMPLETATO: Profitto Netto Simulato +${net_profit:.2f}")
            else:
                self._log(f"🔥 REAL HEDGE {pair}: Lancio MARKET Orders ({buy_exchange} vs {sell_exchange})")
                results = await asyncio.gather(buy_task, sell_task, return_exceptions=True)
                
                # Check errori
                errs = [r for r in results if isinstance(r, Exception)]
                if errs:
                    self._log(f"❌ ERRORE in Hedge Reale! {errs}")
                    # In un sistema avanzato qui scatterebbe logica di "Unwind" (chiusura gambe scoperte)
                else:
                    self._log(f"✅ REAL HEDGE {pair} ESEGUITO CON SUCCESSO!")
        except Exception as e:
            self._log(f"❌ Eccezione fatale esecuzione {pair}: {e}")

    async def check_arbitrage(self, pair):
        b_bid = self.prices[pair]["binance"]["bid"]
        b_ask = self.prices[pair]["binance"]["ask"]
        k_bid = self.prices[pair]["kraken"]["bid"]
        k_ask = self.prices[pair]["kraken"]["ask"]
        
        if b_bid == 0 or k_bid == 0: return
            
        current_time = time.time()
        if current_time - self.last_execution_time[pair] < 5.0:
            return # Cooldown di 5s dopo un trade sullo stesso pair per far assestare l'orderbook
            
        qty = self.trade_qty[pair]
        
        # Le taker fees riducono lo spread netto
        total_fee_perc = self.fees['binance'] + self.fees['kraken']
        
        # Case 1: Buy Kraken, Sell Binance
        spread1 = b_bid - k_ask
        profit1_perc = (spread1 / k_ask)
        net_profit1_perc = profit1_perc - total_fee_perc
        
        # Case 2: Buy Binance, Sell Kraken
        spread2 = k_bid - b_ask
        profit2_perc = (spread2 / b_ask)
        net_profit2_perc = profit2_perc - total_fee_perc
        
        if net_profit1_perc > 0.0001: # 0.01% Netto minimo richiesto
            self.last_execution_time[pair] = current_time
            self._log(f"⚡ {pair} SPREAD RILEVATO: Buy KRA @ {k_ask:.3f} | Sell BIN @ {b_bid:.3f} | Net Prof %: {net_profit1_perc*100:.3f}%")
            await self.execute_hedging(pair, "kraken", "binance", k_ask, b_bid, qty)
            
        elif net_profit2_perc > 0.0001:
            self.last_execution_time[pair] = current_time
            self._log(f"⚡ {pair} SPREAD RILEVATO: Buy BIN @ {b_ask:.3f} | Sell KRA @ {k_bid:.3f} | Net Prof %: {net_profit2_perc*100:.3f}%")
            await self.execute_hedging(pair, "binance", "kraken", b_ask, k_bid, qty)

    async def _arb_loop(self):
        self._log(f"🚀 Avvio CCXT Arbitrage Engine ({'PAPER' if self.paper_mode else 'REAL'} MODE)")
        await self.init_ccxt()
        if not self.binance_client.apiKey or not self.kraken_client.apiKey:
            self._log("❌ ERRORE: API keys mancanti per Binance o Kraken. Controlla le impostazioni!")
            self.running = False
            self.bot_state.modules["crypto_arb"] = False
            return
        await asyncio.gather(
            self.connect_binance(),
            self.connect_kraken()
        )
        self._log("Motore DeFi Arbitrage fermato.")
        
        if self.binance_client: await self.binance_client.close()
        if self.kraken_client: await self.kraken_client.close()

    def loop(self):
        self.running = True
        try:
            asyncio.run(self._arb_loop())
        except Exception as e:
            self._log(f"Errore critico motore: {str(e)}")
        finally:
            self.running = False
