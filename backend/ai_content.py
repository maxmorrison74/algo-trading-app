import time
import random
import datetime
import os
import json
import requests
import threading

class AIContentCreator:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.project_id = None
        self.location = "us-central1"
        
        self.news_topics = [
            "Bitcoin verso nuovi massimi, cosa dicono gli analisti istituzionali",
            "Il nuovo aggiornamento DeFi e come trarne profitto",
            "Intelligenza Artificiale: l'impatto sul trading algoritmico",
            "Mercati globali in tensione, beni rifugio in salita"
        ]
        
        if not hasattr(self.bot_state, "ai_logs"):
            self.bot_state.ai_logs = []
        if not hasattr(self.bot_state, "ai_videos"):
            self.bot_state.ai_videos = []

    def _log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        print(f"[AI Content] {message}")
        self.bot_state.ai_logs.insert(0, log_msg)
        if len(self.bot_state.ai_logs) > 50:
            self.bot_state.ai_logs.pop()

    def load_gcp_credentials(self):
        try:
            if os.path.exists(".env.gcp.json"):
                with open(".env.gcp.json", "r") as f:
                    data = json.load(f)
                    self.project_id = data.get("project_id")
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".env.gcp.json"
                return True
            return False
        except Exception as e:
            self._log(f"Errore lettura credenziali GCP: {e}")
            return False

    def generate_script_and_prompt(self, topic):
        self._log(f"🧠 [FASE 1] Richiesta a Gemini (Vertex AI) per lo script...")
        try:
            from vertexai.generative_models import GenerativeModel
            import vertexai
            vertexai.init(project=self.project_id, location=self.location)
            
            model = GenerativeModel("gemini-1.5-pro")
            prompt = f"Sei un esperto creatore di contenuti per YouTube Shorts. Scrivi uno script di 45 secondi su: '{topic}'. Dopo lo script, fornisci un prompt esatto e iper-dettagliato in inglese per generare un video realistico e cinematico con Google Veo che faccia da sfondo allo script. Formato: SCRIPT: ... PROMPT_VEO: ..."
            
            response = model.generate_content(prompt)
            text = response.text
            
            script_part = text.split("PROMPT_VEO:")[0].replace("SCRIPT:", "").strip()
            veo_prompt = text.split("PROMPT_VEO:")[1].strip() if "PROMPT_VEO:" in text else "Cinematic 4k shot of trading charts."
            
            self._log(f"✅ Script e Prompt Veo generati con successo!")
            return script_part, veo_prompt
        except Exception as e:
            self._log(f"❌ Errore Gemini: {e}")
            return "Script fallback", "Cinematic stock market footage, 4k, hyper-realistic"

    def loop(self):
        self.running = True
        self._log("Accensione Fabbrica Video IA (Vertex AI Edition)...")
        
        while self.running and self.bot_state.modules.get("ai_content", False):
            try:
                if not self.load_gcp_credentials():
                    self._log("⚠️ Nessuna chiave GCP trovata. Mettiti in pausa...")
                    time.sleep(10)
                    continue
                    
                topic = random.choice(self.news_topics)
                self._log(f"🔎 [FASE 0] Selezionato argomento: '{topic}'")
                
                # 1. Script & Prompt
                script, veo_prompt = self.generate_script_and_prompt(topic)
                
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                
                # 2. Fake TTS for now
                self._log(f"🎙️ [FASE 2] Generazione voce AI (Mock ElevenLabs)...")
                time.sleep(3)
                
                # 3. Simulate Veo Generation
                self._log(f"🎞️ [FASE 3] Invio prompt a Google Veo: '{veo_prompt[:40]}...'")
                self._log(f"⏳ Attesa rendering video da Veo (Google Cloud)...")
                for i in range(1, 4):
                    if not self.running: break
                    time.sleep(3)
                    self._log(f"🎞️ Rendering in corso ({i*33}%)...")
                
                if not self.running or not self.bot_state.modules.get("ai_content", False): break
                self._log(f"✅ Video Veo generato e scaricato!")
                
                # 4. Upload
                self._log(f"🚀 [FASE 4] Caricamento su YouTube Shorts...")
                time.sleep(2)
                
                views = random.randint(5000, 100000)
                earnings = round((views / 1000.0) * random.uniform(1.0, 3.5), 2)
                
                self._log(f"💰 Video caricato! Stimato AdSense: +${earnings}")
                self.bot_state.virtual_cash += earnings
                
                video_obj = {
                    "id": str(int(time.time() * 1000)),
                    "title": topic,
                    "thumbnail": "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&q=80&w=200&h=300",
                    "views": views,
                    "earnings": earnings,
                    "timestamp": datetime.datetime.now().strftime("%H:%M")
                }
                
                self.bot_state.ai_videos.insert(0, video_obj)
                if len(self.bot_state.ai_videos) > 10:
                    self.bot_state.ai_videos.pop()
                
                self._log(f"⏳ Pausa prima del prossimo corto (15s)...")
                for _ in range(15):
                    if not self.running: break
                    time.sleep(1)
                
            except Exception as e:
                self._log(f"Errore Pipeline AI: {str(e)[:100]}")
                time.sleep(5)
                
        self.running = False
        self._log("Fabbrica Video IA spenta.")

    def stop(self):
        self.running = False
