"""
Capital Manager - Gestione transizione Paper → Live
"""

import os
import json
from enum import Enum
from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime, timedelta

class TradingMode(Enum):
    PAPER = "paper"
    MICRO_LIVE = "micro_live"      # €500-1000
    SMALL_LIVE = "small_live"      # €2000-5000
    FULL_LIVE = "full_live"        # €10000+

@dataclass
class PhaseCriteria:
    min_days: int
    min_trades: int
    min_win_rate: float           # %
    min_profit_factor: float
    max_drawdown: float           # %
    min_sharpe: float

# Criteri per passare alla fase successiva
PHASE_REQUIREMENTS = {
    TradingMode.PAPER: PhaseCriteria(
        min_days=30,
        min_trades=50,
        min_win_rate=55.0,
        min_profit_factor=1.3,
        max_drawdown=10.0,
        min_sharpe=0.5
    ),
    TradingMode.MICRO_LIVE: PhaseCriteria(
        min_days=14,
        min_trades=20,
        min_win_rate=52.0,
        min_profit_factor=1.2,
        max_drawdown=8.0,
        min_sharpe=0.3
    ),
    TradingMode.SMALL_LIVE: PhaseCriteria(
        min_days=30,
        min_trades=50,
        min_win_rate=55.0,
        min_profit_factor=1.3,
        max_drawdown=10.0,
        min_sharpe=0.5
    )
}

@dataclass
class CapitalConfig:
    mode: str = "paper"
    paper_capital: float = 1000.0    # $1k virtuale
    micro_capital: float = 500.0     # €500 reale
    small_capital: float = 2000.0    # €2000 reale
    full_capital: float = 10000.0    # €10000 reale
    current_capital: float = 1000.0
    phase_start_date: str = ""
    total_trades: int = 0
    winning_trades: int = 0
    total_profit: float = 0.0
    total_loss: float = 0.0
    max_drawdown: float = 0.0
    peak_capital: float = 1000.0

class CapitalManager:
    def __init__(self):
        self.config = CapitalConfig()
        self._file = os.path.join(os.path.dirname(__file__), "capital_config.json")
        self._load()
        
    def _load(self):
        if os.path.exists(self._file):
            try:
                with open(self._file, 'r') as f:
                    data = json.load(f)
                    self.config = CapitalConfig(**data)
            except:
                pass
                
        if not self.config.phase_start_date:
            self.config.phase_start_date = datetime.now().isoformat()
            self.save()
                
    def save(self):
        with open(self._file, 'w') as f:
            json.dump(asdict(self.config), f, indent=2)

    def _get_phase_elapsed_days(self) -> int:
        if not self.config.phase_start_date:
            return 0
        try:
            started_at = datetime.fromisoformat(self.config.phase_start_date)
        except ValueError:
            return 0
        return max(1, (datetime.now() - started_at).days + 1)
            
    def get_current_mode(self) -> TradingMode:
        return TradingMode(self.config.mode)
        
    def get_trade_size_limit(self) -> float:
        """Max % del capitale per singolo trade"""
        mode = self.get_current_mode()
        limits = {
            TradingMode.PAPER: 0.10,        # 10% paper
            TradingMode.MICRO_LIVE: 0.05,   # 5% micro (più conservativo)
            TradingMode.SMALL_LIVE: 0.08,   # 8% small
            TradingMode.FULL_LIVE: 0.10     # 10% full
        }
        return limits.get(mode, 0.05)
        
    def can_go_live(self) -> tuple[bool, str]:
        """Verifica se si può passare alla fase successiva"""
        mode = self.get_current_mode()
        
        if mode == TradingMode.FULL_LIVE:
            return False, "Già a massima capitalizzazione"
            
        next_mode = {
            TradingMode.PAPER: TradingMode.MICRO_LIVE,
            TradingMode.MICRO_LIVE: TradingMode.SMALL_LIVE,
            TradingMode.SMALL_LIVE: TradingMode.FULL_LIVE
        }.get(mode)
        
        if not next_mode:
            return False, "Modalità non valida"
            
        criteria = PHASE_REQUIREMENTS.get(mode)
        if not criteria:
            return True, "Nessun criterio definito, procedi con cautela"
            
        # Verifica criteri
        days = self._get_phase_elapsed_days()
               
        checks = []
        checks.append((days >= criteria.min_days, f"Giorni: {days}/{criteria.min_days}"))
        checks.append((self.config.total_trades >= criteria.min_trades, 
                      f"Trades: {self.config.total_trades}/{criteria.min_trades}"))
        
        win_rate = (self.config.winning_trades / self.config.total_trades * 100) \
                   if self.config.total_trades > 0 else 0
        checks.append((win_rate >= criteria.min_win_rate, 
                      f"Win rate: {win_rate:.1f}%/{criteria.min_win_rate}%"))
        
        profit_factor = abs(self.config.total_profit / self.config.total_loss) \
                        if self.config.total_loss > 0 else 999.0
        checks.append((profit_factor >= criteria.min_profit_factor,
                      f"Profit factor: {profit_factor:.2f}/{criteria.min_profit_factor}"))
        
        checks.append((self.config.max_drawdown <= criteria.max_drawdown,
                      f"Drawdown: {self.config.max_drawdown:.1f}%/{criteria.max_drawdown}%"))
        
        passed = [c[0] for c in checks]
        details = [c[1] for c in checks]
        
        if all(passed):
            return True, f"✅ Pronto per {next_mode.value}! " + " | ".join(details)
        else:
            return False, "❌ Non pronto: " + " | ".join(details)
            
    def advance_phase(self) -> tuple[bool, str]:
        """Passa alla fase successiva se i criteri sono soddisfatti"""
        can_advance, msg = self.can_go_live()
        if not can_advance:
            return False, msg
            
        mode = self.get_current_mode()
        next_mode = {
            TradingMode.PAPER: TradingMode.MICRO_LIVE,
            TradingMode.MICRO_LIVE: TradingMode.SMALL_LIVE,
            TradingMode.SMALL_LIVE: TradingMode.FULL_LIVE
        }.get(mode)
        
        if next_mode:
            self.config.mode = next_mode.value
            self.config.phase_start_date = datetime.now().isoformat()
            self.config.current_capital = {
                TradingMode.MICRO_LIVE: self.config.micro_capital,
                TradingMode.SMALL_LIVE: self.config.small_capital,
                TradingMode.FULL_LIVE: self.config.full_capital
            }.get(next_mode, self.config.current_capital)
            self.save()
            return True, f"🚀 Fase avanzata a {next_mode.value}! Capitale: €{self.config.current_capital}"
            
        return False, "Errore avanzamento fase"
        
    def record_trade_result(self, pnl: float):
        """Registra il risultato di un trade"""
        self.config.total_trades += 1
        if pnl > 0:
            self.config.winning_trades += 1
            self.config.total_profit += pnl
        else:
            self.config.total_loss += abs(pnl)
            
        self.config.current_capital += pnl
        
        # Update peak and drawdown
        if self.config.current_capital > self.config.peak_capital:
            self.config.peak_capital = self.config.current_capital
        else:
            dd = (self.config.peak_capital - self.config.current_capital) / self.config.peak_capital * 100
            self.config.max_drawdown = max(self.config.max_drawdown, dd)
            
        self.save()
        
    def get_status(self) -> dict:
        """Stato completo per dashboard"""
        mode = self.get_current_mode()
        can_advance, advance_msg = self.can_go_live()
        win_rate = (self.config.winning_trades / self.config.total_trades * 100) \
                   if self.config.total_trades > 0 else 0
        profit_factor = abs(self.config.total_profit / self.config.total_loss) \
                        if self.config.total_loss > 0 else 0
                        
        return {
            "mode": mode.value,
            "current_capital": round(self.config.current_capital, 2),
            "trade_limit_pct": self.get_trade_size_limit() * 100,
            "total_trades": self.config.total_trades,
            "win_rate": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": round(self.config.max_drawdown, 2),
            "can_advance": can_advance,
            "advance_message": advance_msg,
            "phase_start": self.config.phase_start_date,
            "phase_days": self._get_phase_elapsed_days(),
            "next_checklist": self._get_checklist()
        }
        
    def _get_checklist(self) -> dict:
        """Checklist visiva per il frontend"""
        mode = self.get_current_mode()
        criteria = PHASE_REQUIREMENTS.get(mode)
        if not criteria:
            return {}
            
        days = self._get_phase_elapsed_days()
        win_rate = (self.config.winning_trades / self.config.total_trades * 100) \
                   if self.config.total_trades > 0 else 0
        profit_factor = abs(self.config.total_profit / self.config.total_loss) \
                        if self.config.total_loss > 0 else 999.0
                        
        return {
            "days": {"current": days, "required": criteria.min_days, "ok": days >= criteria.min_days},
            "trades": {"current": self.config.total_trades, "required": criteria.min_trades, "ok": self.config.total_trades >= criteria.min_trades},
            "win_rate": {"current": round(win_rate, 1), "required": criteria.min_win_rate, "ok": win_rate >= criteria.min_win_rate},
            "profit_factor": {"current": round(profit_factor, 2), "required": criteria.min_profit_factor, "ok": profit_factor >= criteria.min_profit_factor},
            "drawdown": {"current": round(self.config.max_drawdown, 1), "required": criteria.max_drawdown, "ok": self.config.max_drawdown <= criteria.max_drawdown}
        }


# Singleton
_capital_manager: Optional[CapitalManager] = None

def get_capital_manager() -> CapitalManager:
    global _capital_manager
    if _capital_manager is None:
        _capital_manager = CapitalManager()
    return _capital_manager
