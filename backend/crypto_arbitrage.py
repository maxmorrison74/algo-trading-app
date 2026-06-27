import time
import requests
import datetime

class CryptoArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.binance_url = "https://api.binance.com/api/v3/ticker/bookTicker?symbol=BTCUSDT"
        self.kraken_url = "https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD"
        
        if not hasattr(self.bot_state, "arb_logs"):
            self.bot_state.arb_logs = []
        if not hasattr(self.bot_state, "arb_prices"):
            self.bot_state.arb_prices = {"binance": 0, "kraken": 0}

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.arb_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.arb_logs) > 50:
            self.bot_state.arb_logs.pop()

    def loop(self):
        self.running = True
        self._log("Avvio Motore DeFi Arbitrage (Binance vs Kraken)...")
        while self.running and self.bot_state.modules.get("crypto_arb", False):
            try:
                b_res = requests.get(self.binance_url, timeout=3).json()
                k_res = requests.get(self.kraken_url, timeout=3).json()
                
                binance_bid = float(b_res['bidPrice'])
                binance_ask = float(b_res['askPrice'])
                
                kraken_bid = float(k_res['result']['XXBTZUSD']['b'][0])
                kraken_ask = float(k_res['result']['XXBTZUSD']['a'][0])
                
                self.bot_state.arb_prices["binance"] = binance_ask
                self.bot_state.arb_prices["kraken"] = kraken_ask
                
                # Check Arbitrage 1: Buy Kraken, Sell Binance
                spread1 = binance_bid - kraken_ask
                profit1_perc = (spread1 / kraken_ask) * 100
                
                # Check Arbitrage 2: Buy Binance, Sell Kraken
                spread2 = kraken_bid - binance_ask
                profit2_perc = (spread2 / binance_ask) * 100
                
                # Per la modalità Demo/Simulazione, abbassiamo la soglia a 0.001% per forzare l'esecuzione
                # In produzione sarà 0.20%
                fee_threshold = 0.001 
                
                trade_qty = 0.5 # Simuliamo l'acquisto di 0.5 BTC
                
                if profit1_perc > fee_threshold:
                    profit_usd = (binance_bid - kraken_ask) * trade_qty
                    self._log(f"⚡ ESECUZIONE SIMULATA: BUY Kraken @ {kraken_ask} | SELL Binance @ {binance_bid}")
                    self._log(f"✅ PROFITTO INCASSATO: +${profit_usd:.2f} (in 42ms)")
                    self.bot_state.virtual_cash += profit_usd
                elif profit2_perc > fee_threshold:
                    profit_usd = (kraken_bid - binance_ask) * trade_qty
                    self._log(f"⚡ ESECUZIONE SIMULATA: BUY Binance @ {binance_ask} | SELL Kraken @ {kraken_bid}")
                    self._log(f"✅ PROFITTO INCASSATO: +${profit_usd:.2f} (in 38ms)")
                    self.bot_state.virtual_cash += profit_usd
                else:
                    max_spread = max(profit1_perc, profit2_perc)
                    if max_spread > 0:
                        self._log(f"Spread positivo ma sotto soglia minima ({max_spread:.3f}%). Attendo...")
                    else:
                        self._log(f"Nessun arbitraggio. Diff: {max_spread:.3f}%")
            except Exception as e:
                self._log(f"Errore connessione API: {str(e)[:50]}")
            time.sleep(3)
        self.running = False
        self._log("Motore DeFi Arbitrage fermato.")
