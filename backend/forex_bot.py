import time
import os
from forex_trading import get_forex_pricing, execute_forex_trade
from risk_manager import get_risk_manager

class ForexEngine:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.user_id = "admin"
        self.oanda_key = None
        self.oanda_account = None

    def init_clients(self):
        from db import get_api_keys
        keys = get_api_keys(self.user_id) or {}
        
        self.oanda_key = keys.get("oanda_key", "").strip(' \t\n\r"\'')
        self.oanda_account = keys.get("oanda_account", "").strip(' \t\n\r"\'')
        
        if not self.oanda_key or not self.oanda_account:
            self.bot_state.add_log("❌ OANDA: Chiavi non configurate. Impossibile avviare il Forex Engine.")
            return False
        return True

    def loop(self):
        try:
            self.running = True
            if not self.init_clients():
                self.running = False
                return

            self.bot_state.add_log("🌍 FOREX: Motore AI Forex avviato con successo.")
            
            while self.running and self.bot_state.modules.get("trading", False):
                # 1. Check Risk
                risk = get_risk_manager(self.bot_state.virtual_cash)
                can_trade, reason = risk.can_trade()
                if not can_trade:
                    self.bot_state.add_log(f"🌍 FOREX: ⛔ {reason}")
                    time.sleep(60)
                    continue

                # 2. Fetch Prices
                target_pairs = "EUR_USD,GBP_USD,USD_JPY"
                res = get_forex_pricing(self.oanda_key, self.oanda_account, target_pairs)
                if res.get("status") == "success":
                    prices = res.get("prices", {})
                    # TODO: Pass prices to LLM for decision making
                    # For now, we just log that we are monitoring.
                    # We will implement LLM sentiment/macro-economic evaluation here.
                    self.bot_state.add_log(f"🌍 FOREX: Monitoraggio {target_pairs} in corso...")
                else:
                    self.bot_state.add_log(f"❌ FOREX: Errore API OANDA: {res.get('message')}")
                
                # Check every 5 minutes (Forex is slower moving than HFT crypto)
                for _ in range(60 * 5):
                    if not self.running or not self.bot_state.modules.get("trading", False):
                        break
                    time.sleep(1)
                    
            self.bot_state.add_log("🌍 FOREX: Motore AI Forex fermato.")
            self.running = False
            
        except Exception as e:
            self.bot_state.add_log(f"💥 CRASH CRITICO nel Forex Engine: {e}")
            self.running = False
