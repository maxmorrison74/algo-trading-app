import threading
import time
import models, database
from alpaca_trading import AlpacaEngine
from crypto_arbitrage import CryptoArbitrage
import asyncio

class SaaSOrchestrator:
    def __init__(self):
        self.running_alpaca_engines = {}
        self.running_crypto_engines = {}
        self.running = False

    def start(self):
        self.running = True
        threading.Thread(target=self._monitor_users_loop, daemon=True).start()

    def stop(self):
        self.running = False
        for user_id, engine in self.running_alpaca_engines.items():
            engine.running = False
        for user_id, engine in self.running_crypto_engines.items():
            engine.running = False

    def _monitor_users_loop(self):
        """Scansiona periodicamente il DB per avviare o fermare i bot degli utenti."""
        while self.running:
            try:
                db = next(database.get_db())
                active_users = db.query(models.User).filter(models.User.subscription_active == True).all()
                active_user_ids = set([u.id for u in active_users])
                
                # Ferma bot di utenti il cui abbonamento è scaduto
                for uid in list(self.running_alpaca_engines.keys()):
                    if uid not in active_user_ids:
                        self.running_alpaca_engines[uid].running = False
                        del self.running_alpaca_engines[uid]
                        
                for uid in list(self.running_crypto_engines.keys()):
                    if uid not in active_user_ids:
                        self.running_crypto_engines[uid].running = False
                        del self.running_crypto_engines[uid]

                # Avvia bot per i nuovi utenti o aggiorna le chiavi
                for user in active_users:
                    # In una versione avanzata potremmo leggere quali moduli ha attivato l'utente
                    # dal DB (es. user.trading_enabled). Per ora li avviamo se hanno le chiavi.
                    
                    if user.id not in self.running_alpaca_engines and user.alpaca_key and user.alpaca_secret:
                        # Dobbiamo adattare AlpacaEngine per ricevere le chiavi e l'ID utente!
                        pass
                        
                    if user.id not in self.running_crypto_engines and user.binance_key and user.kraken_key:
                        pass
                        
            except Exception as e:
                print(f"Errore Orchestrator: {e}")
                
            time.sleep(30) # Controlla ogni 30 secondi

orchestrator = SaaSOrchestrator()
