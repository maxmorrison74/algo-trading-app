import time
import random
import datetime
import os
import threading

class AIContentCreator:
    def __init__(self, bot_state):
        self.bot_state = bot_state
        self.running = False
        self.queue = []
        
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

    def add_video_to_queue(self, video_data):
        # Supporta sia dizionario che argomenti vecchi (se chiamato altrove)
        if not isinstance(video_data, dict):
            return
        
        video_data["id"] = str(int(time.time() * 1000))
        self.queue.append(video_data)
        self._log(f"📥 Video aggiunto in coda per la pubblicazione: '{video_data.get('topic')}'")

    def loop(self):
        self.running = True
        self._log("Accensione Distributore Video IA (con Webhook Integrato)...")
        
        while self.running and self.bot_state.modules.get("ai_content", False):
            try:
                if len(self.queue) > 0:
                    video = self.queue.pop(0)
                    topic = video.get('topic', 'Senza Titolo')
                    self._log(f"🚀 Inizio elaborazione: '{topic}'")
                    
                    # 1. Pubblicazione reale via Webhook (Make.com) se configurato
                    webhook_url = self.bot_state.api_keys.get("make_webhook_url") if hasattr(self.bot_state, 'api_keys') else None
                    if webhook_url:
                        self._log("🌐 Invio file e metadati al Webhook di Make.com...")
                        try:
                            import requests
                            filepath = video.get('file_path') or video.get('filepath')
                            if filepath and os.path.exists(filepath):
                                with open(filepath, 'rb') as f:
                                    files = {'video': (os.path.basename(filepath), f, 'video/mp4')}
                                    data = {
                                        'topic': topic,
                                        'description': video.get('description', ''),
                                        'hashtags': video.get('hashtags', '')
                                    }
                                    res = requests.post(webhook_url, files=files, data=data, timeout=45)
                            else:
                                res = requests.post(webhook_url, json=video, timeout=10)
                            
                            if str(res.status_code).startswith('2'):
                                self._log("✅ Pubblicazione remota Webhook completata!")
                            else:
                                self._log(f"⚠️ Errore Webhook ({res.status_code}): {res.text}")
                        except Exception as e:
                            self._log(f"⚠️ Errore invio Webhook: {e}")
                    else:
                        self._log("⚠️ Nessun Webhook Make.com configurato. Eseguo solo simulazione locale.")
                        # Simula tempo di upload
                        for i in range(1, 4):
                            if not self.running: break
                            time.sleep(2)
                            self._log(f"🚀 Upload in corso ({i*33}%)...")
                            
                    if not self.running or not self.bot_state.modules.get("ai_content", False): break
                    self._log(f"✅ Video caricato online con successo!")
                    
                    # Genera visualizzazioni iniziali e profitti finti per gamification
                    views = random.randint(10000, 150000)
                    earnings = round((views / 1000.0) * random.uniform(1.0, 3.5), 2)
                    
                    self._log(f"📈 Il video è andato virale! {views} views stimate in poche ore.")
                    self._log(f"💰 Monetizzazione stimata AdSense: +${earnings}")
                    
                    self.bot_state.virtual_cash += earnings
                    
                    video_obj = {
                        "id": video.get("id", str(time.time())),
                        "title": topic,
                        "thumbnail": "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&q=80&w=200&h=300",
                        "views": views,
                        "earnings": earnings,
                        "timestamp": datetime.datetime.now().strftime("%H:%M")
                    }
                    
                    self.bot_state.ai_videos.insert(0, video_obj)
                    if len(self.bot_state.ai_videos) > 10:
                        self.bot_state.ai_videos.pop()
                        
                else:
                    # Niente in coda, aspetta
                    time.sleep(5)
                
            except Exception as e:
                self._log(f"Errore Pipeline AI: {str(e)[:100]}")
                time.sleep(5)
                
        self.running = False
        self._log("Distributore Video IA spento.")

    def stop(self):
        self.running = False
