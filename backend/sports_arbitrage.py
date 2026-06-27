import time
import random
import datetime

class SportsArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.bookmakers = ["Snai", "Bet365", "WilliamHill", "Pinnacle", "Bwin", "Eurobet"]
        self.players = [
            ("Sinner", "Alcaraz"),
            ("Djokovic", "Medvedev"),
            ("Nadal", "Ruud"),
            ("Tsitsipas", "Zverev"),
            ("Berrettini", "Fritz")
        ]
        
        if not hasattr(self.bot_state, "sports_logs"):
            self.bot_state.sports_logs = []
        if not hasattr(self.bot_state, "active_surebets"):
            self.bot_state.active_surebets = []

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.sports_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.sports_logs) > 50:
            self.bot_state.sports_logs.pop()

    def generate_odds(self):
        # 90% delle volte genera quote normali, 10% genera un'arbitraggio
        p1, p2 = random.choice(self.players)
        book1, book2 = random.sample(self.bookmakers, 2)
        
        is_arbitrage = random.random() < 0.15
        
        if is_arbitrage:
            # Creiamo una surebet forzata
            odds1 = round(random.uniform(2.05, 2.30), 2)
            odds2 = round(random.uniform(2.05, 2.30), 2)
        else:
            # Quote normali (allibraggio a favore del bookmaker)
            odds1 = round(random.uniform(1.30, 1.80), 2)
            odds2 = round(random.uniform(1.30, 2.10), 2)
            
        return {
            "match": f"{p1} vs {p2}",
            "book1": book1,
            "book2": book2,
            "odds1": odds1,
            "odds2": odds2,
            "p1": p1,
            "p2": p2
        }

    def loop(self):
        self.running = True
        self._log("Avvio Radar SureBets (Simulatore Quote V1)...")
        while self.running and self.bot_state.modules.get("sports_arb", False):
            try:
                data = self.generate_odds()
                match_str = data["match"]
                o1 = data["odds1"]
                o2 = data["odds2"]
                
                # Calcolo matematica arbitraggio
                arb_percent = (1.0 / o1) + (1.0 / o2)
                
                if arb_percent < 1.0:
                    profit_margin = (1.0 - arb_percent) * 100
                    self._log(f"🔥 SUREBET TROVATA! {match_str} -> Profitto: {profit_margin:.2f}%")
                    
                    # Esempio su 100 euro totali
                    total_investment = 100.0
                    stake1 = (100.0 / o1) / arb_percent
                    stake2 = (100.0 / o2) / arb_percent
                    guaranteed_return = total_investment / arb_percent
                    
                    surebet_data = {
                        "id": str(int(time.time() * 1000)),
                        "match": match_str,
                        "p1": data["p1"],
                        "p2": data["p2"],
                        "book1": data["book1"],
                        "book2": data["book2"],
                        "odds1": o1,
                        "odds2": o2,
                        "profit_margin": profit_margin,
                        "stake1": stake1,
                        "stake2": stake2,
                        "guaranteed_return": guaranteed_return,
                        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
                    }
                    
                    self.bot_state.active_surebets.insert(0, surebet_data)
                    if len(self.bot_state.active_surebets) > 5:
                        self.bot_state.active_surebets.pop()
                else:
                    self._log(f"Scansione {match_str}: Margine Bookmaker {(arb_percent - 1.0)*100:.2f}%. Nessuna SureBet.")
                
            except Exception as e:
                self._log(f"Errore scansione: {str(e)[:50]}")
            time.sleep(2)
            
        self.running = False
        self._log("Radar SureBets fermato.")
