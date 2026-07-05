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
        self.standard_pairs = ["BTC", "ETH", "SOL", "XRP"]
        self.high_risk_pairs = ["DOGE", "SHIB", "PEPE", "WIF", "LINK"]
        self.pairs = self.standard_pairs + self.high_risk_pairs
        
        # CCXT Markets uses standard symbols like BTC/USDT
        self.ccxt_symbols = {
            "BTC": "BTC/USDT",
            "ETH": "ETH/USDT",
            "SOL": "SOL/USDT",
            "XRP": "XRP/USDT",
            "DOGE": "DOGE/USDT",
            "SHIB": "SHIB/USDT",
            "PEPE": "PEPE/USDT",
            "WIF": "WIF/USDT",
            "LINK": "LINK/USDT"
        }
        
        self.binance_streams = {
            "BTC": "btcusdt",
            "ETH": "ethusdt",
            "SOL": "solusdt",
            "XRP": "xrpusdt",
            "DOGE": "dogeusdt",
            "SHIB": "shibusdt",
            "PEPE": "pepeusdt",
            "WIF": "wifusdt",
            "LINK": "linkusdt"
        }
        
        self.kraken_streams = {
            "BTC": "XBT/USD",
            "ETH": "ETH/USD",
            "SOL": "SOL/USD",
            "XRP": "XRP/USD",
            "DOGE": "DOGE/USD",
            "SHIB": "SHIB/USD",
            "PEPE": "PEPE/USD",
            "WIF": "WIF/USD",
            "LINK": "LINK/USD"
        }

        # Size fissa per hedge
        self.trade_qty = {
            "BTC": 0.01,
            "ETH": 0.5,
            "SOL": 10.0,
            "XRP": 500.0,
            "DOGE": 1000.0,
            "SHIB": 5000000.0,
            "PEPE": 10000000.0,
            "WIF": 100.0,
            "LINK": 20.0
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
        if not hasattr(self.bot_state, "high_risk_arb_logs"):
            self.bot_state.high_risk_arb_logs = []
        if not hasattr(self.bot_state, "arb_prices"):
            self.bot_state.arb_prices = {"binance": 0, "kraken": 0}
        if not hasattr(self.bot_state, "high_risk_arb_prices"):
            self.bot_state.high_risk_arb_prices = {}
            
        self.last_execution_time = {pair: 0 for pair in self.pairs}
        
        self.binance_client = None
        self.kraken_client = None

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        msg = f"[{timestamp}] {message}"
        self.bot_state.arb_logs.insert(0, msg)
        if len(self.bot_state.arb_logs) > 50:
            self.bot_state.arb_logs.pop()
        
        # Copia i log generici anche nel tab Alto Rischio se attivo
        if self.bot_state.modules.get("high_risk_crypto_arb", False):
            if not hasattr(self.bot_state, "high_risk_arb_logs"):
                self.bot_state.high_risk_arb_logs = []
            self.bot_state.high_risk_arb_logs.insert(0, msg)
            if len(self.bot_state.high_risk_arb_logs) > 50:
                self.bot_state.high_risk_arb_logs.pop()

    def _log_pair(self, pair, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        msg = f"[{timestamp}] {message}"
        if pair in self.high_risk_pairs:
            if not hasattr(self.bot_state, "high_risk_arb_logs"):
                self.bot_state.high_risk_arb_logs = []
            self.bot_state.high_risk_arb_logs.insert(0, msg)
            if len(self.bot_state.high_risk_arb_logs) > 50:
                self.bot_state.high_risk_arb_logs.pop()
        else:
            self.bot_state.arb_logs.insert(0, msg)
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
        
        # Fallback to DB for admin
        try:
            from db import get_api_keys
            user_keys = get_api_keys("admin") or {}
            b_key = b_key or user_keys.get("binance_key", "")
            b_secret = b_secret or user_keys.get("binance_secret", "")
            k_key = k_key or user_keys.get("kraken_key", "")
            k_secret = k_secret or user_keys.get("kraken_secret", "")
        except Exception:
            pass

        
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
        
        while self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
            try:
                async with websockets.connect(uri) as ws:
                    self._log(f"Binance WebSocket Connesso ({', '.join(self.pairs)}).")
                    while self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        payload = json.loads(message)
                        
                        if 'stream' in payload and 'data' in payload:
                            stream_name = payload['stream'].split('@')[0]
                            data = payload['data']
                            pair = stream_to_pair.get(stream_name)
                            
                            if pair and 'b' in data and 'a' in data:
                                self.prices[pair]["binance"]["bid"] = float(data['b'])
                                self.prices[pair]["binance"]["ask"] = float(data['a'])
                                
                                # Filtro moduli
                                is_high_risk = pair in self.high_risk_pairs
                                mod_needed = "high_risk_crypto_arb" if is_high_risk else "crypto_arb"
                                if not self.bot_state.modules.get(mod_needed, False):
                                    continue
                                    
                                if pair == "BTC":
                                    self.bot_state.arb_prices["binance"] = float(data['a'])
                                    
                                if is_high_risk:
                                    if not hasattr(self.bot_state, "high_risk_arb_prices"):
                                        self.bot_state.high_risk_arb_prices = {}
                                    self.bot_state.high_risk_arb_prices[pair] = {
                                        "binance": float(data['a']),
                                        "kraken": self.prices[pair]["kraken"]["ask"] or float(data['a'])
                                    }
                                    
                                await self.check_arbitrage(pair)
            except Exception as e:
                if self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
                    self._log(f"Errore Binance WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)
            
    async def connect_kraken(self):
        uri = "wss://ws.kraken.com"
        
        # Invert map
        stream_to_pair = {v: k for k, v in self.kraken_streams.items()}
        
        while self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
            try:
                async with websockets.connect(uri) as ws:
                    self._log(f"Kraken WebSocket Connesso ({', '.join(self.pairs)}).")
                    subscribe_msg = {
                        "event": "subscribe",
                        "pair": list(self.kraken_streams.values()),
                        "subscription": {"name": "ticker"}
                    }
                    await ws.send(json.dumps(subscribe_msg))
                    
                    while self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
                        message = await asyncio.wait_for(ws.recv(), timeout=10)
                        data = json.loads(message)
                        
                        if isinstance(data, list) and len(data) > 3:
                            ticker = data[1]
                            pair_kraken = data[3]
                            pair = stream_to_pair.get(pair_kraken)
                            
                            if pair and 'b' in ticker and 'a' in ticker:
                                self.prices[pair]["kraken"]["bid"] = float(ticker['b'][0])
                                self.prices[pair]["kraken"]["ask"] = float(ticker['a'][0])
                                
                                # Filtro moduli
                                is_high_risk = pair in self.high_risk_pairs
                                mod_needed = "high_risk_crypto_arb" if is_high_risk else "crypto_arb"
                                if not self.bot_state.modules.get(mod_needed, False):
                                    continue
                                    
                                if pair == "BTC":
                                    self.bot_state.arb_prices["kraken"] = float(ticker['a'][0])
                                    
                                if is_high_risk:
                                    if not hasattr(self.bot_state, "high_risk_arb_prices"):
                                        self.bot_state.high_risk_arb_prices = {}
                                    self.bot_state.high_risk_arb_prices[pair] = {
                                        "binance": self.prices[pair]["binance"]["ask"] or float(ticker['a'][0]),
                                        "kraken": float(ticker['a'][0])
                                    }
                                    
                                await self.check_arbitrage(pair)
            except Exception as e:
                if self.running and (self.bot_state.modules.get("crypto_arb", False) or self.bot_state.modules.get("high_risk_crypto_arb", False)):
                    self._log(f"Errore Kraken WS: {str(e)[:50]}. Riconnessione...")
                    await asyncio.sleep(2)

    async def execute_hedging(self, pair, buy_exchange, sell_exchange, buy_price, sell_price, qty):
        # In paper_mode NON creare coroutine reali: altrimenti restano "was never awaited".
        ccxt_sym = self.ccxt_symbols[pair]

        try:
            if self.paper_mode:
                self._log_pair(pair, f"⚠️ PAPER HEDGE {pair}: BUY {buy_exchange} ({qty}), SELL {sell_exchange} ({qty})")
                await asyncio.sleep(0.5)

                spread_val = sell_price - buy_price
                fees = (buy_price * self.fees[buy_exchange]) + (sell_price * self.fees[sell_exchange])
                net_profit = (spread_val * qty) - (fees * qty)

                self.bot_state.virtual_cash += net_profit
                self._log_pair(pair, f"✅ PAPER HEDGE COMPLETATO: Profitto Netto Simulato +${net_profit:.2f}")
                return

            self._log_pair(pair, f"🔥 REAL HEDGE {pair}: Lancio MARKET Orders ({buy_exchange} vs {sell_exchange})")

            if buy_exchange == "binance":
                buy_coro = self.binance_client.create_market_buy_order(ccxt_sym, qty)
                sell_coro = self.kraken_client.create_market_sell_order(ccxt_sym, qty)
            else:
                buy_coro = self.kraken_client.create_market_buy_order(ccxt_sym, qty)
                sell_coro = self.binance_client.create_market_sell_order(ccxt_sym, qty)

            results = await asyncio.gather(buy_coro, sell_coro, return_exceptions=True)

            errs = [r for r in results if isinstance(r, Exception)]
            if errs:
                self._log_pair(pair, f"❌ ERRORE in Hedge Reale! {errs}")
            else:
                self._log_pair(pair, f"✅ REAL HEDGE {pair} ESEGUITO CON SUCCESSO!")

        except Exception as e:
            self._log_pair(pair, f"❌ Eccezione fatale esecuzione {pair}: {e}")

    async def verify_depth_and_adjust_qty(self, pair, buy_exchange, sell_exchange, qty):
        """
        Verifica la profondità dell'order book per evitare lo slippage.
        Ritorna la quantità ottimale da scambiare (pari o inferiore a qty).
        Se non c'è abbastanza liquidità o lo spread svanisce, ritorna 0.0.
        """
        ccxt_binance_sym = self.ccxt_symbols[pair]
        ccxt_kraken_sym = self.kraken_streams[pair]
        
        buy_client = self.binance_client if buy_exchange == "binance" else self.kraken_client
        buy_sym = ccxt_binance_sym if buy_exchange == "binance" else ccxt_kraken_sym
        
        sell_client = self.binance_client if sell_exchange == "binance" else self.kraken_client
        sell_sym = ccxt_binance_sym if sell_exchange == "binance" else ccxt_kraken_sym
        
        try:
            # Recupera gli order book in parallelo
            buy_ob, sell_ob = await asyncio.gather(
                buy_client.fetch_order_book(buy_sym, limit=5),
                sell_client.fetch_order_book(sell_sym, limit=5)
            )
            
            # Per comprare (buy_exchange), guardiamo gli ASK (lettera)
            # Per vendere (sell_exchange), guardiamo i BID (denaro)
            asks = buy_ob.get('asks', [])
            bids = sell_ob.get('bids', [])
            
            if not asks or not bids:
                return 0.0
                
            # Calcoliamo quanta quantità qty è disponibile a prezzi convenienti
            accum_qty_buy = 0.0
            weighted_buy_sum = 0.0
            
            for price, vol in asks:
                needed = qty - accum_qty_buy
                if needed <= 0:
                    break
                take_vol = min(vol, needed)
                accum_qty_buy += take_vol
                weighted_buy_sum += price * take_vol
                
            if accum_qty_buy < qty * 0.5: # Se non c'è nemmeno il 50% della liquidità richiesta
                self._log_pair(pair, f"⚠️ LIQUIDITÀ INSUFFICIENTE (Buy) su {buy_exchange} per {pair}: richiesti {qty}, trovati solo {accum_qty_buy:.4f}")
                return 0.0
                
            avg_buy_price = weighted_buy_sum / accum_qty_buy
            
            # Lato Sell (Bid)
            accum_qty_sell = 0.0
            weighted_sell_sum = 0.0
            
            for price, vol in bids:
                needed = qty - accum_qty_sell
                if needed <= 0:
                    break
                take_vol = min(vol, needed)
                accum_qty_sell += take_vol
                weighted_sell_sum += price * take_vol
                
            if accum_qty_sell < qty * 0.5:
                self._log_pair(pair, f"⚠️ LIQUIDITÀ INSUFFICIENTE (Sell) su {sell_exchange} per {pair}: richiesti {qty}, trovati solo {accum_qty_sell:.4f}")
                return 0.0
                
            avg_sell_price = weighted_sell_sum / accum_qty_sell
            
            # Quantità massima eseguibile
            exec_qty = min(accum_qty_buy, accum_qty_sell)
            
            # Verifica se lo spread netto basato sui prezzi reali (ponderati) è ancora profittevole
            total_fee_perc = self.fees['binance'] + self.fees['kraken']
            real_spread = avg_sell_price - avg_buy_price
            real_profit_perc = real_spread / avg_buy_price
            real_net_profit_perc = real_profit_perc - total_fee_perc
            
            if real_net_profit_perc <= 0.0001:
                self._log_pair(pair, f"⚠️ SLIPPAGE PROTECT: Lo spread stimato sui book per {pair} svanisce a causa dei volumi (Profitto Netto Stimato: {real_net_profit_perc*100:.3f}%). Trade annullato.")
                return 0.0
                
            return exec_qty
            
        except Exception as e:
            self._log_pair(pair, f"⚠️ Impossibile verificare profondità book per {pair}: {e}. Uso quantità di default.")
            return qty

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
            if pair in self.high_risk_pairs and getattr(self.bot_state, "auto_bet_enabled", False):
                self._log_pair(pair, f"⚡ {pair} SPREAD RILEVATO! Avvio analisi AI per Auto-Scalp...")
                asyncio.create_task(self.evaluate_ai_and_buy(pair, b_bid))
            else:
                self._log_pair(pair, f"⚡ {pair} SPREAD RILEVATO: Buy KRA @ {k_ask:.3f} | Sell BIN @ {b_bid:.3f} | Net Prof %: {net_profit1_perc*100:.3f}%")
                opt_qty = await self.verify_depth_and_adjust_qty(pair, "kraken", "binance", qty)
                if opt_qty > 0.0:
                    await self.execute_hedging(pair, "kraken", "binance", k_ask, b_bid, opt_qty)
            
        elif net_profit2_perc > 0.0001:
            self.last_execution_time[pair] = current_time
            if pair in self.high_risk_pairs and getattr(self.bot_state, "auto_bet_enabled", False):
                self._log_pair(pair, f"⚡ {pair} SPREAD RILEVATO! Avvio analisi AI per Auto-Scalp...")
                asyncio.create_task(self.evaluate_ai_and_buy(pair, b_ask))
            else:
                self._log_pair(pair, f"⚡ {pair} SPREAD RILEVATO: Buy BIN @ {b_ask:.3f} | Sell KRA @ {k_bid:.3f} | Net Prof %: {net_profit2_perc*100:.3f}%")
                opt_qty = await self.verify_depth_and_adjust_qty(pair, "binance", "kraken", qty)
                if opt_qty > 0.0:
                    await self.execute_hedging(pair, "binance", "kraken", b_ask, k_bid, opt_qty)

    async def evaluate_ai_and_buy(self, pair, current_price):
        """Richiama l'endpoint AI internamente per valutare l'auto-scalp."""
        import aiohttp
        import datetime
        from api import _send_telegram_trade
        
        # Evita duplicati se è già in sorveglianza
        if any(p["symbol"] == pair for p in getattr(self.bot_state, "monitored_positions", [])):
            return
            
        try:
            async with aiohttp.ClientSession() as session:
                payload = {"symbol": pair, "price": current_price, "change_24h": 0.0, "volatility": 2.0}
                async with session.post("http://127.0.0.1:8000/api/high-risk/ai-signal", json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        score = data.get("confidence", 0)
                        signal = data.get("signal", "HOLD")
                        
                        if signal == "BUY" and score >= 80:
                            amount_to_invest = 100.0  # Dimensione fissa 100$ per gli auto-scalp
                            if self.bot_state.virtual_cash >= amount_to_invest:
                                qty = amount_to_invest / current_price
                                self.bot_state.virtual_cash -= amount_to_invest
                                
                                new_pos = {
                                    "symbol": pair,
                                    "buy_price": current_price,
                                    "qty": qty,
                                    "amount": amount_to_invest,
                                    "peak_price": current_price,
                                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
                                }
                                self.bot_state.monitored_positions.append(new_pos)
                                
                                log_msg = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🤖 AUTO-SCALP {pair} {qty:.4f} @ ${current_price:.6f} — Score: {score}/100"
                                self.bot_state.high_risk_arb_logs.insert(0, log_msg)
                                _send_telegram_trade(
                                    event="BUY", symbol=pair, qty=qty, price=current_price,
                                    reason=f"🤖 Auto-Scalp AI (Score {score})", virtual_cash=self.bot_state.virtual_cash
                                )
                                self.bot_state.save_state()
                        else:
                            self._log_pair(pair, f"🤖 Analisi AI per {pair}: Score {score}/100, segnale {signal}. Acquisto annullato.")
        except Exception as e:
            self._log_pair(pair, f"❌ Errore AI evaluation: {e}")

    async def scan_market_volatility(self):
        try:
            if not self.binance_client:
                return
            tickers = await self.binance_client.fetch_tickers()
            volatile_list = []
            for sym, t in tickers.items():
                if not sym.endswith("/USDT"):
                    continue
                base = sym.split("/")[0]
                if base in ["BTC", "ETH", "USDC", "FDUSD", "USDT"]:
                    continue
                high = t.get('high')
                low = t.get('low')
                close = t.get('close')
                if high and low and low > 0 and close:
                    vol = ((high - low) / low) * 100
                    change = t.get('percentage', 0.0)
                    volatile_list.append({
                        "symbol": base,
                        "pair": sym,
                        "price": close,
                        "volatility": round(vol, 2),
                        "change_24h": round(change, 2)
                    })
            # Ordina per volatilità decrescente
            volatile_list.sort(key=lambda x: x["volatility"], reverse=True)
            self.bot_state.high_risk_volatile_assets = volatile_list[:5]
        except Exception as e:
            pass

    async def _volatility_loop(self):
        while self.running:
            if self.bot_state.modules.get("high_risk_crypto_arb", False):
                await self.scan_market_volatility()
            await asyncio.sleep(60)

    async def _arb_loop(self):
        self._log(f"🚀 Avvio CCXT Arbitrage Engine ({'PAPER' if self.paper_mode else 'REAL'} MODE)")
        await self.init_ccxt()
        if not self.binance_client.apiKey or not self.kraken_client.apiKey:
            self._log("❌ ERRORE: API keys mancanti per Binance o Kraken. Controlla le impostazioni!")
            self.running = False
            self.bot_state.modules["crypto_arb"] = False
            self.bot_state.modules["high_risk_crypto_arb"] = False
            return
            
        # Carica una prima scansione di volatilità subito se attivo
        if self.bot_state.modules.get("high_risk_crypto_arb", False):
            await self.scan_market_volatility()
            
        await asyncio.gather(
            self.connect_binance(),
            self.connect_kraken(),
            self._volatility_loop()
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
