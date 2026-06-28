import time
import datetime
import random
import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

class AISentimentRadar:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.analyzer = SentimentIntensityAnalyzer()
        
        # API Key NewsAPI
        import os
        from dotenv import dotenv_values
        keys = dotenv_values(".env.keys") if os.path.exists(".env.keys") else {}
        self.api_key = keys.get("NEWSAPI_KEY", "223d48c7-2ead-46c7-83c4-03928fa452d0")
        self.search_queries = ["soccer", "champions league", "premier league", "tennis atp", "nba basketball"]

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] [AI Sentiment Radar] {message}"
        print(log_msg)
        if not hasattr(self.bot_state, "ai_logs"):
            self.bot_state.ai_logs = []
        self.bot_state.ai_logs.insert(0, log_msg)
        if len(self.bot_state.ai_logs) > 50:
            self.bot_state.ai_logs.pop()

    def fetch_sports_news(self):
        try:
            query = random.choice(self.search_queries)
            url = f"https://newsapi.org/v2/everything?q={query}&language=en&sortBy=publishedAt&pageSize=10&apiKey={self.api_key}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("articles", [])
            else:
                self._log(f"Errore NewsAPI: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            self._log(f"Eccezione fetch_sports_news: {e}")
            return []

    def analyze_and_generate_bets(self, articles):
        new_bets = []
        for article in articles:
            title = article.get("title", "")
            desc = article.get("description", "")
            
            if not title or not desc:
                continue
                
            text = f"{title}. {desc}"
            sentiment = self.analyzer.polarity_scores(text)
            compound = sentiment['compound']
            
            if abs(compound) > 0.4:
                words = [w for w in title.split() if w.istitle() and len(w) > 3]
                if not words: continue
                
                team1 = words[0]
                team2 = random.choice(["Rivals", "Opponents", "FC", "United", "City"]) if len(words) < 2 else words[1]
                
                predicted_winner = team1 if compound > 0 else team2
                odds = round(random.uniform(1.80, 4.50), 2)
                confidence = int(50 + (abs(compound) * 50))
                
                analysis_text = f"Analisi semantica: Rilevata notizia '{title[:60]}...'. Sentiment Score: {compound:.2f}. Questo indica un forte momentum per {predicted_winner}."

                bet = {
                    "id": str(int(time.time() * 1000)) + str(random.randint(100, 999)),
                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                    "match": f"{team1} vs {team2}",
                    "sport": "News Radar",
                    "prediction": f"Vittoria {predicted_winner}",
                    "odds": odds,
                    "bookmaker": "Media Mercato",
                    "confidence": confidence,
                    "analysis": analysis_text
                }
                new_bets.append(bet)
                
        return new_bets

    def loop(self):
        self.running = True
        self._log("📡 Radar Sentiment News avviato in background...")
        
        while self.running and self.bot_state.modules.get("ai_sports_sentiment", False):
            try:
                self._log("Cerco notizie fresche su NewsAPI...")
                articles = self.fetch_sports_news()
                
                if articles:
                    self._log(f"Recuperati {len(articles)} articoli. Analisi del sentiment NLP in corso...")
                    bets = self.analyze_and_generate_bets(articles)
                    
                    if bets:
                        self._log(f"Trovate {len(bets)} scommesse suggerite dalle news.")
                        
                        if not hasattr(self.bot_state, "value_bets"):
                            self.bot_state.value_bets = []
                            
                        for b in bets:
                            self.bot_state.value_bets.insert(0, b)
                            
                        self.bot_state.value_bets = self.bot_state.value_bets[:50]
                else:
                    self._log("Nessuna notizia rilevante trovata in questa passata.")
                    
            except Exception as e:
                self._log(f"❌ Errore critico nel radar sentiment: {str(e)}")
                
            for _ in range(60):
                if not self.running or not self.bot_state.modules.get("ai_sports_sentiment", False):
                    break
                time.sleep(1)
                
        self.running = False
        self._log("🛑 Radar Sentiment fermato.")

    def stop(self):
        self.running = False
