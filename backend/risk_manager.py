"""
Risk Manager - Kill Switch automatico per trading live
"""

import os
import json
import time
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict
from enum import Enum

class RiskStatus(Enum):
    GREEN = "green"      # Tutto ok
    YELLOW = "yellow"    # Avviso
    RED = "red"          # STOP TRADING
    BLACK = "black"      # Circuit breaker (stop per 24h)

@dataclass
class RiskLimits:
    max_daily_loss_pct: float = 3.0           # Max perdita giornaliera %
    max_weekly_loss_pct: float = 5.0          # Max perdita settimanale %
    max_single_trade_loss_pct: float = 2.0    # Max perdita per trade %
    max_drawdown_pct: float = 10.0            # Max drawdown totale %
    max_open_positions: int = 5               # Max posizioni aperte
    max_correlation: float = 0.7              # Max correlazione tra posizioni
    max_leverage: float = 1.0                 # NO LEVERAGE default
    circuit_breaker_cooldown_hours: int = 24   # Ore di stop dopo circuit breaker

@dataclass
class RiskState:
    daily_pnl: float = 0.0
    weekly_pnl: float = 0.0
    total_pnl: float = 0.0
    peak_equity: float = 0.0
    current_equity: float = 0.0
    max_drawdown_pct: float = 0.0
    open_positions: int = 0
    trades_today: int = 0
    status: str = "green"
    last_trade_time: Optional[str] = None
    circuit_breaker_until: Optional[str] = None
    alerts: List[str] = None
    
    def __post_init__(self):
        if self.alerts is None:
            self.alerts = []

class RiskManager:
    def __init__(self, initial_capital: float = 10000.0, limits: Optional[RiskLimits] = None):
        self.initial_capital = initial_capital
        self.limits = limits or RiskLimits()
        self.state = RiskState(current_equity=initial_capital, peak_equity=initial_capital)
        self._lock = threading.RLock()
        self._state_file = os.path.join(os.path.dirname(__file__), "risk_state.json")
        self._daily_reset_time = datetime.now().replace(hour=0, minute=0, second=0)
        self._load_state()
        
    def _load_state(self):
        """Carica stato precedente se esiste"""
        if os.path.exists(self._state_file):
            try:
                with open(self._state_file, 'r') as f:
                    data = json.load(f)
                    self.state = RiskState(**data)
                    # Verifica se è un nuovo giorno
                    self._check_daily_reset()
            except Exception as e:
                print(f"[RISK] Errore caricamento stato: {e}")
                
    def _save_state(self):
        """Salva stato su disco"""
        try:
            with self._lock:
                with open(self._state_file, 'w') as f:
                    json.dump(asdict(self.state), f, indent=2)
        except Exception as e:
            print(f"[RISK] Errore salvataggio stato: {e}")
            
    def _check_daily_reset(self):
        """Resetta contatori giornalieri se è un nuovo giorno"""
        now = datetime.now()
        if now.date() > self._daily_reset_time.date():
            with self._lock:
                self.state.daily_pnl = 0.0
                self.state.trades_today = 0
                self._daily_reset_time = now
                self._add_alert("🌅 Nuovo giorno - contatori resettati")
                
    def _add_alert(self, message: str):
        """Aggiunge un alert con timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        alert = f"[{timestamp}] {message}"
        self.state.alerts.insert(0, alert)
        # Mantieni solo ultimi 50 alert
        self.state.alerts = self.state.alerts[:50]
        print(f"[RISK ALERT] {alert}")
        
    def can_trade(self) -> tuple[bool, str]:
        """
        Verifica se è consentito tradare.
        Returns: (allowed: bool, reason: str)
        """
        with self._lock:
            self._check_daily_reset()
            
            # 1. Verifica circuit breaker
            if self.state.circuit_breaker_until:
                until = datetime.fromisoformat(self.state.circuit_breaker_until)
                if datetime.now() < until:
                    remaining = (until - datetime.now()).total_seconds() / 3600
                    return False, f"🔒 CIRCUIT BREAKER attivo per altre {remaining:.1f}h"
                else:
                    self.state.circuit_breaker_until = None
                    self.state.status = "green"
                    self._add_alert("🔓 Circuit breaker scaduto, trading ripristinato")
                    
            # 2. Verifica drawdown
            if self.state.max_drawdown_pct >= self.limits.max_drawdown_pct:
                self._trigger_circuit_breaker("Drawdown massimo raggiunto")
                return False, f"🔒 STOP: Drawdown {self.state.max_drawdown_pct:.1f}% > limite {self.limits.max_drawdown_pct}%"
                
            # 3. Verifica perdita giornaliera
            daily_loss_pct = abs(self.state.daily_pnl) / self.initial_capital * 100
            if daily_loss_pct >= self.limits.max_daily_loss_pct:
                self._trigger_circuit_breaker("Perdita giornaliera massima")
                return False, f"🔒 STOP: Perdita giornaliera {daily_loss_pct:.1f}% > limite {self.limits.max_daily_loss_pct}%"
                
            # 4. Verifica perdita settimanale
            weekly_loss_pct = abs(self.state.weekly_pnl) / self.initial_capital * 100
            if weekly_loss_pct >= self.limits.max_weekly_loss_pct:
                self._trigger_circuit_breaker("Perdita settimanale massima")
                return False, f"🔒 STOP: Perdita settimanale {weekly_loss_pct:.1f}% > limite {self.limits.max_weekly_loss_pct}%"
                
            # 5. Verifica max posizioni
            if self.state.open_positions >= self.limits.max_open_positions:
                return False, f"⚠️ Max posizioni aperte ({self.limits.max_open_positions}) raggiunto"
                
            return True, "✅ Trading consentito"
            
    def _trigger_circuit_breaker(self, reason: str):
        """Attiva il circuit breaker"""
        cooldown = timedelta(hours=self.limits.circuit_breaker_cooldown_hours)
        until = datetime.now() + cooldown
        self.state.circuit_breaker_until = until.isoformat()
        self.state.status = "black"
        self._add_alert(f"⛔ CIRCUIT BREAKER: {reason}. Stop per {self.limits.circuit_breaker_cooldown_hours}h")
        self._save_state()
        
    def update_equity(self, new_equity: float):
        """Aggiorna equity e calcola metriche"""
        with self._lock:
            self._check_daily_reset()
            
            old_equity = self.state.current_equity
            self.state.current_equity = new_equity
            
            # Calcola P&L
            pnl = new_equity - old_equity
            self.state.daily_pnl += pnl
            self.state.weekly_pnl += pnl
            self.state.total_pnl += pnl
            
            # Aggiorna peak e drawdown
            if new_equity > self.state.peak_equity:
                self.state.peak_equity = new_equity
            else:
                dd = (self.state.peak_equity - new_equity) / self.state.peak_equity * 100
                self.state.max_drawdown_pct = max(self.state.max_drawdown_pct, dd)
                
            # Aggiorna status
            self._update_status()
            self._save_state()
            
    def _update_status(self):
        """Aggiorna il colore dello status"""
        daily_loss_pct = abs(self.state.daily_pnl) / self.initial_capital * 100
        dd_pct = self.state.max_drawdown_pct
        
        if dd_pct > self.limits.max_drawdown_pct * 0.8:
            self.state.status = "red"
        elif daily_loss_pct > self.limits.max_daily_loss_pct * 0.7:
            self.state.status = "yellow"
        else:
            self.state.status = "green"
            
    def record_trade(self, symbol: str, side: str, qty: float, price: float, pnl: float = 0.0):
        """Registra un trade eseguito"""
        with self._lock:
            self.state.trades_today += 1
            self.state.last_trade_time = datetime.now().isoformat()
            
            if pnl != 0:
                self.update_equity(self.state.current_equity + pnl)
                
            self._add_alert(f"📊 Trade: {side} {qty} {symbol} @ ${price:.2f} | P&L: ${pnl:.2f}")
            self._save_state()
            
    def get_position_size(self, confidence: float, price: float) -> float:
        """
        Calcola la dimensione della posizione con Kelly Criterion Avanzato (Modalità Cecchino)
        """
        with self._lock:
            # Kelly: f* = confidence - (1 - confidence) = 2*confidence - 1
            kelly = (2 * confidence - 1)
            
            # Modalità Cecchino: se confidenza >= 80%, scommettiamo pesante (fino al 40% di esposizione max)
            if confidence >= 0.80:
                kelly *= 0.8  # Aggressive Kelly
                kelly = max(0, min(kelly, 0.40))  # Max 40% del capitale
            else:
                # Setup normali: conservativi
                kelly *= 0.4  # Conservative Kelly
                kelly = max(0, min(kelly, 0.15))  # Max 15% del capitale
                
            # Riduci drasticamente se drawdown è alto (sicurezza)
            if self.state.max_drawdown_pct > 5.0:
                kelly *= 0.3  # Taglia le scommesse del 70%
                
            position_value = self.state.current_equity * kelly
            qty = position_value / price if price > 0 else 0
            
            return round(qty, 4)
            
    def get_status(self) -> Dict:
        """Restituisce stato completo per API/dashboard"""
        with self._lock:
            self._check_daily_reset()
            can_trade, reason = self.can_trade()
            
            return {
                "status": self.state.status,
                "can_trade": can_trade,
                "reason": reason,
                "equity": round(self.state.current_equity, 2),
                "daily_pnl": round(self.state.daily_pnl, 2),
                "daily_pnl_pct": round(self.state.daily_pnl / self.initial_capital * 100, 2),
                "weekly_pnl": round(self.state.weekly_pnl, 2),
                "total_pnl": round(self.state.total_pnl, 2),
                "max_drawdown_pct": round(self.state.max_drawdown_pct, 2),
                "open_positions": self.state.open_positions,
                "trades_today": self.state.trades_today,
                "initial_capital": self.initial_capital,
                "alerts": self.state.alerts[:10],  # Solo ultimi 10
                "circuit_breaker_until": self.state.circuit_breaker_until
            }
            
    def close_all_positions(self, callback=None):
        """Chiudi tutte le posizioni (emergenza)"""
        self._add_alert("🚨 EMERGENZA: Chiusura forzata tutte le posizioni")
        if callback:
            callback()
        self.state.open_positions = 0
        self._save_state()


# Singleton per l'app
_risk_manager: Optional[RiskManager] = None

def get_risk_manager(initial_capital: float = 10000.0) -> RiskManager:
    global _risk_manager
    if _risk_manager is None:
        _risk_manager = RiskManager(initial_capital=initial_capital)
    return _risk_manager
