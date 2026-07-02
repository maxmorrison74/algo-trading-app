import sys
import re

# Patch API.PY
API_PATH = "backend/api.py"
with open(API_PATH, "r") as f:
    api_content = f.read()

# 1. Imports
imports = """
from risk_manager import get_risk_manager, RiskLimits
from capital_manager import get_capital_manager
from dataclasses import asdict
"""
if "from risk_manager import get_risk_manager" not in api_content:
    api_content = api_content.replace(
        "from fastapi import FastAPI",
        "from fastapi import FastAPI\n" + imports
    )

# 2. Endpoints
endpoints = """
@app.get("/api/risk/status")
def risk_status():
    \"\"\"Stato del risk manager\"\"\"
    risk = get_risk_manager(initial_capital=bot_state.virtual_cash)
    return risk.get_status()

@app.post("/api/risk/limits")
def update_risk_limits(limits: dict):
    \"\"\"Aggiorna i limiti di risk (solo admin)\"\"\"
    risk = get_risk_manager()
    risk.limits = RiskLimits(**limits)
    return {"status": "ok", "limits": asdict(risk.limits)}

@app.post("/api/risk/emergency-stop")
def emergency_stop():
    \"\"\"Kill switch manuale\"\"\"
    risk = get_risk_manager()
    risk._trigger_circuit_breaker("STOP MANUALE dall'utente")
    
    # Chiudi tutte le posizioni Alpaca (se presente)
    try:
        if alpaca:
            positions = alpaca.list_positions()
            for p in positions:
                alpaca.submit_order(
                    symbol=p.symbol,
                    qty=p.qty,
                    side='sell' if p.side == 'long' else 'buy',
                    type='market',
                    time_in_force='day'
                )
    except Exception as e:
        return {"status": "error", "message": str(e)}
        
    return {"status": "ok", "message": "🛑 EMERGENCY STOP eseguito"}

@app.get("/api/capital/status")
def capital_status():
    \"\"\"Stato gestione capitale\"\"\"
    cap = get_capital_manager()
    return cap.get_status()

@app.post("/api/capital/advance")
def advance_phase():
    \"\"\"Prova ad avanzare alla fase successiva\"\"\"
    cap = get_capital_manager()
    success, msg = cap.advance_phase()
    return {"success": success, "message": msg}
"""
if "@app.get(\"/api/risk/status\")" not in api_content:
    api_content = api_content.replace(
        "@app.get(\"/health\")",
        endpoints + "\n@app.get(\"/health\")"
    )

# 3. Aggiornare l'esecuzione paper per notificare risk e capital
if "bot_state.trade_history.append({" in api_content:
    injection = """
                    risk = get_risk_manager(initial_capital=bot_state.virtual_cash)
                    cap = get_capital_manager()
                    risk.record_trade(symbol, "AUTO-EXIT", qty=amount, price=current_price, pnl=realized_profit)
                    cap.record_trade_result(realized_profit)
                    
                    bot_state.trade_history.append({"""
    api_content = api_content.replace(
        "bot_state.trade_history.append({",
        injection,
        1  # Solo la prima istanza, per il close order principale nel Virtual Paper loop
    )

with open(API_PATH, "w") as f:
    f.write(api_content)
    
print("API.PY patched!")

# Patch ALPACA_TRADING.PY
ALPACA_PATH = "backend/alpaca_trading.py"
with open(ALPACA_PATH, "r") as f:
    alpaca_content = f.read()

# Rimuovi la logica di limitazione drawdown statica
def remove_drawdown_logic(content):
    pattern = r"def check_drawdown\(self\).*?# .*?\n"
    content = re.sub(pattern, "", content, flags=re.DOTALL)
    
    # Rimuovi la chiamata a check_drawdown
    content = content.replace("        if not self.check_drawdown():\n            return\n", "")
    return content
    
alpaca_content = remove_drawdown_logic(alpaca_content)

# Sostituisci get_kelly_size e esecuzione
alpaca_content = alpaca_content.replace(
"""    def get_kelly_size(self, symbol, confidence):
        # ... logic ...
        return round(size, 4)""",
""
)

alpaca_imports = """
from risk_manager import get_risk_manager
from capital_manager import get_capital_manager
"""
if "from risk_manager import get_risk_manager" not in alpaca_content:
    alpaca_content = alpaca_content.replace(
        "from ensemble_ml import EnsembleTradingModel",
        "from ensemble_ml import EnsembleTradingModel\n" + alpaca_imports
    )

# Iniettare il controllo can_trade in loop
if "def loop(self):" in alpaca_content and "get_risk_manager" not in alpaca_content.split("def loop(self):")[1]:
    loop_injection = """
        risk = get_risk_manager(self.bot_state.virtual_cash)
        can_trade, reason = risk.can_trade()
        if not can_trade:
            self._log(f"⛔ {reason}")
            self.running = False
            return
"""
    alpaca_content = alpaca_content.replace(
        "        self.prefill_history()",
        "        self.prefill_history()\n" + loop_injection
    )
    
with open(ALPACA_PATH, "w") as f:
    f.write(alpaca_content)
    
print("ALPACA_TRADING.PY patched!")
