import time
import random
import datetime

class AIContentCreator:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        
        self.news_topics = [
            "Bitcoin tocco i 100k, cosa dicono gli analisti",
            "Il nuovo ETF su Ethereum approvato dalla SEC",
            "S&P 500 ai massimi storici, bolla in arrivo?",
            "Come guadagnare con l'arbitraggio DeFi nel 2026",
            "Crollo del mercato Asiatico, opportunità di acquisto?",
            "Intelligenza Artificiale: le 3 crypto da comprare oggi"
        ]
        
        self.thumbnails = [
            "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&q=80&w=200&h=300", # Bitcoin neon
            "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=200&h=300", # Trading charts
            "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=200&h=300", # Money
            "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=200&h=300", # Blockchain grid
            "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=200&h=300"  # Crypto mix
        ]
        
        if not hasattr(self.bot_state, "ai_logs"):
            self.bot_state.ai_logs = []
        if not hasattr(self.bot_state, "ai_videos"):
            self.bot_state.ai_videos = []

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.bot_state.ai_logs.insert(0, f"[{timestamp}] {message}")
        if len(self.bot_state.ai_logs) > 50:
            self.bot_state.ai_logs.pop()

    def loop(self):
        self.running = True
        self._log("Accensione Fabbrica Video IA...")
        
        while self.running and self.bot_state.modules.get("ai_content", False):
            try:
                # 1. Scraping
                topic = random.choice(self.news_topics)
                self._log(f"🔎 [FASE 1] Scraping RSS feed... Trovata notizia virale: '{topic}'")
                time.sleep(3)
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                
                # 2. Script
                self._log(f"🧠 [FASE 2] Chiamata a Gemini API per la generazione dello script persuasivo...")
                time.sleep(3)
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                self._log(f"✅ Script di 45 secondi generato. Hook Retention Score: 92/100")
                
                # 3. TTS
                self._log(f"🎙️ [FASE 3] Generazione clone vocale (ElevenLabs API)...")
                time.sleep(3)
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                
                # 4. Render
                self._log(f"🎞️ [FASE 4] Rendering Video: Applicazione B-Roll stock e sottotitoli dinamici (0%)...")
                time.sleep(2)
                self._log(f"🎞️ [FASE 4] Rendering Video in corso (45%)...")
                time.sleep(2)
                self._log(f"🎞️ [FASE 4] Rendering Video in corso (89%)...")
                time.sleep(2)
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                
                # 5. Upload
                self._log(f"🚀 [FASE 5] Connessione API TikTok / YouTube Shorts...")
                time.sleep(2)
                self._log(f"✅ Video caricato con successo!")
                
                # Generate fake views and earnings
                views = random.randint(1000, 50000)
                rpm = random.uniform(0.5, 2.5) # Revenue per 1000 views
                earnings = (views / 1000.0) * rpm
                
                self._log(f"💰 Monetizzazione stimata AdSense: +${earnings:.2f}")
                
                # Update global state
                self.bot_state.virtual_cash += earnings
                
                video_obj = {
                    "id": str(int(time.time() * 1000)),
                    "title": topic,
                    "thumbnail": random.choice(self.thumbnails),
                    "views": views,
                    "earnings": earnings,
                    "timestamp": datetime.datetime.now().strftime("%H:%M")
                }
                
                self.bot_state.ai_videos.insert(0, video_obj)
                if len(self.bot_state.ai_videos) > 10:
                    self.bot_state.ai_videos.pop()
                
                self._log(f"⏳ Pausa per raffreddamento API prima del prossimo video (10s)...")
                time.sleep(10)
                
            except Exception as e:
                self._log(f"Errore Pipeline AI: {str(e)[:50]}")
                time.sleep(5)
                
        self.running = False
        self._log("Fabbrica Video IA spenta.")
