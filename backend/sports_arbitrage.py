import time
import datetime
import requests
import os

# --- Legge la chiave THEODDS_KEY dal vault .env.keys ---
def _load_keys():
    keys = {}
    key_paths = [".env.keys", "../.env.keys"]
    for path in key_paths:
        try:
            with open(path, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        keys[k] = v
        except Exception:
            pass
    return keys

# Tutti gli sport supportati da The-Odds-API
ALL_SPORTS = [
    "soccer_italy_serie_a",
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_uefa_champs_league",
    "soccer_uefa_european_championship",
    "soccer_usa_mls",
    "tennis_atp_french_open",
    "tennis_wta_french_open",
    "tennis_atp_wimbledon",
    "tennis_wta_wimbledon",
    "basketball_nba",
    "basketball_euroleague",
    "americanfootball_nfl",
    "icehockey_nhl",
    "baseball_mlb",
]

# Bookmaker italiani/europei da monitorare (whitelist legal)
BOOKMAKERS = [
    "bet365", "williamhill", "bwin", "unibet",
    "pinnacle", "betfair", "snai", "lottomatica",
    "sisal", "eurobet", "betsson", "1xbet",
    "marathonbet", "betclic"
]

class SportsArbitrage:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.api_key = None
        
        if not hasattr(self.bot_state, "sports_logs"):
            self.bot_state.sports_logs = []
        if not hasattr(self.bot_state, "active_surebets"):
            self.bot_state.active_surebets = []

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.bot_state.sports_logs.insert(0, entry)
        print(entry)
        if len(self.bot_state.sports_logs) > 100:
            self.bot_state.sports_logs.pop()

    def _load_api_key(self):
        keys = _load_keys()
        key = keys.get("THEODDS_KEY", os.getenv("THEODDS_KEY", ""))
        if not key:
            self._log("⚠️ THEODDS_KEY non trovata. Vai in Impostazioni e salva la chiave.")
        return key

    def _get_live_odds(self, sport_key: str):
        """Recupera le quote live per uno sport tramite The-Odds-API."""
        url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds"
        params = {
            "apiKey": self.api_key,
            "regions": "eu",           # Bookmaker europei
            "markets": "h2h",          # Head-to-head (1X2 / moneyline)
            "oddsFormat": "decimal",
            "dateFormat": "iso",
        }
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 401:
                self._log("❌ THEODDS_KEY non valida. Controlla le impostazioni.")
                return []
            elif resp.status_code == 422:
                # Sport non disponibile in questo momento (stagione chiusa)
                return []
            else:
                self._log(f"⚠️ API Error {resp.status_code} su {sport_key}")
                return []
        except Exception as e:
            self._log(f"⚠️ Errore di rete su {sport_key}: {str(e)[:60]}")
            return []

    def _get_available_sports(self):
        """Recupera la lista degli sport attivi in questo momento."""
        url = "https://api.the-odds-api.com/v4/sports"
        params = {"apiKey": self.api_key}
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                active = [s["key"] for s in resp.json() if s.get("active")]
                self._log(f"📡 Sport attivi trovati: {len(active)}")
                return active
            return ALL_SPORTS
        except Exception:
            return ALL_SPORTS

    def _check_arbitrage(self, event):
        """
        Calcola se esiste un'opportunità di arbitraggio su un evento.
        Prende le migliori quote per ogni outcome da bookmaker diversi.
        """
        match_name = event.get("home_team", "?") + " vs " + event.get("away_team", "?")
        sport = event.get("sport_key", "")
        
        bookmakers = event.get("bookmakers", [])
        if len(bookmakers) < 2:
            return None

        # Raggruppa le migliori quote per ogni outcome (1, X, 2)
        best_odds = {}  # {outcome_name: {"price": float, "bookmaker": str}}
        
        for bk in bookmakers:
            bk_name = bk.get("title", bk.get("key", "Unknown"))
            for market in bk.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                for outcome in market.get("outcomes", []):
                    oname = outcome.get("name")
                    oprice = float(outcome.get("price", 0))
                    if oprice > 0:
                        if oname not in best_odds or oprice > best_odds[oname]["price"]:
                            best_odds[oname] = {"price": oprice, "bookmaker": bk_name}

        if len(best_odds) < 2:
            return None

        # Calcola margine arbitraggio: somma(1/quota_i) < 1 = surebet!
        outcomes = list(best_odds.items())
        arb_sum = sum(1.0 / o["price"] for _, o in outcomes)
        
        MIN_PROFIT_PCT = 1.0  # Ignoriamo surebets sotto l'1% (commissioni, ritardi)
        
        if arb_sum < 1.0 and (1.0 - arb_sum) * 100 >= MIN_PROFIT_PCT:
            profit_margin = (1.0 - arb_sum) * 100

            # Calcola stakes ottimali su €100 totali
            total_stake = 100.0
            stakes = {}
            for outcome_name, odd_data in outcomes:
                stakes[outcome_name] = {
                    "stake": round((total_stake / odd_data["price"]) / arb_sum, 2),
                    "bookmaker": odd_data["bookmaker"],
                    "odds": odd_data["price"]
                }

            guaranteed_return = round(total_stake / arb_sum, 2)
            
            return {
                "match": match_name,
                "sport": sport,
                "profit_margin": round(profit_margin, 3),
                "arb_sum": round(arb_sum, 4),
                "outcomes": stakes,
                "guaranteed_return": guaranteed_return,
                # Compatibilità col frontend esistente
                "p1": outcomes[0][0],
                "p2": outcomes[1][0],
                "book1": outcomes[0][1]["bookmaker"],
                "book2": outcomes[1][1]["bookmaker"],
                "odds1": outcomes[0][1]["price"],
                "odds2": outcomes[1][1]["price"],
                "stake1": stakes[outcomes[0][0]]["stake"],
                "stake2": stakes[outcomes[1][0]]["stake"],
            }
        return None

    def scan_all_sports(self):
        """Scansiona tutti gli sport disponibili e cerca opportunità di arbitraggio."""
        active_sports = self._get_available_sports()
        
        # Filtra per sport che ci interessano e che sono attivi
        sports_to_scan = [s for s in ALL_SPORTS if s in active_sports]
        if not sports_to_scan:
            sports_to_scan = active_sports[:10]  # Fallback: usa i primi 10 attivi

        self._log(f"🔍 Scansione {len(sports_to_scan)} sport in corso...")
        
        arb_results = []  # Raccogliamo tutte le opportunità prima di ordinarle
        events_scanned = 0
        
        for sport_key in sports_to_scan:
            if not self.running or not self.bot_state.modules.get("sports_arb", False):
                break
            
            events = self._get_live_odds(sport_key)
            for event in events:
                events_scanned += 1
                result = self._check_arbitrage(event)
                if result:
                    arb_results.append(result)
            
            # Rate limiting gentile per non esaurire i crediti API
            time.sleep(0.5)

        # Ordiniamo dal profitto più alto al più basso
        arb_results.sort(key=lambda x: x["profit_margin"], reverse=True)

        for result in arb_results:
            profit = result["profit_margin"]
            match = result["match"]
            self._log(f"🔥 SUREBET! {match} | Profitto: {profit:.3f}% | {result['book1']} vs {result['book2']}")
            
            surebet_entry = {
                "id": str(int(time.time() * 1000)),
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                **result
            }
            self.bot_state.active_surebets.insert(0, surebet_entry)
            if len(self.bot_state.active_surebets) > 10:
                self.bot_state.active_surebets.pop()

            # --- AUTO-BET: piazza automaticamente se profitto >= 10% ---
            AUTO_BET_THRESHOLD = 10.0
            if profit >= AUTO_BET_THRESHOLD:
                total_stake = 100.0
                guaranteed_return = result.get("guaranteed_return", 0)
                expected_profit = round(guaranteed_return - total_stake, 2)

                if self.bot_state.virtual_cash >= total_stake:
                    self.bot_state.virtual_cash -= total_stake
                    bet_record = {
                        "type": "SUREBET_AUTO",
                        "match": match,
                        "sport": result.get("sport", ""),
                        "p1": result.get("p1"), "p2": result.get("p2"),
                        "book1": result.get("book1"), "book2": result.get("book2"),
                        "odds1": result.get("odds1"), "odds2": result.get("odds2"),
                        "stake1": result.get("stake1"), "stake2": result.get("stake2"),
                        "total_stake": total_stake,
                        "profit_margin": profit,
                        "guaranteed_return": guaranteed_return,
                        "expected_profit": expected_profit,
                        "status": "pending",
                        "auto": True,
                        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
                    }
                    self.bot_state.trade_history.insert(0, bet_record)
                    self._log(
                        f"🤖 AUTO-BET PIAZZATA! {match} | "
                        f"Profitto: {profit:.2f}% >= {AUTO_BET_THRESHOLD}% soglia | "
                        f"Stake: €{total_stake:.2f} → Ritorno atteso: €{guaranteed_return:.2f} (+€{expected_profit:.2f})"
                    )
                else:
                    self._log(
                        f"⚠️ AUTO-BET SALTATA: {match} (profitto {profit:.2f}%) — "
                        f"Saldo insufficiente (disponibile: €{self.bot_state.virtual_cash:.2f})"
                    )

        self._log(f"✅ Scansione completata: {events_scanned} eventi | {len(arb_results)} surebets trovate (ordinate per profitto)")
        return len(arb_results)


    def loop(self):
        self.running = True
        self.api_key = self._load_api_key()
        
        if not self.api_key:
            self._log("❌ Impossibile avviare: chiave THEODDS_KEY mancante.")
            self.running = False
            return

        self._log("🚀 Radar SureBets LIVE avviato (The-Odds-API - tutti gli sport).")
        
        # Ciclo principale: scansione ogni 5 minuti
        SCAN_INTERVAL = 300  # secondi
        
        while self.running and self.bot_state.modules.get("sports_arb", False):
            try:
                self.scan_all_sports()
            except Exception as e:
                self._log(f"⚠️ Errore ciclo principale: {str(e)[:80]}")
            
            # Aspetta 5 minuti tra una scansione e l'altra
            # (The-Odds-API ha un budget di crediti, non polliamo troppo)
            self._log(f"⏳ Prossima scansione tra 5 minuti...")
            for _ in range(SCAN_INTERVAL):
                if not self.running or not self.bot_state.modules.get("sports_arb", False):
                    break
                time.sleep(1)
        
        self.running = False
        self._log("⛔ Radar SureBets fermato.")
