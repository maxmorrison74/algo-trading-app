import os
risk_file = os.path.join(os.path.dirname(__file__), "risk_state.json")
if os.path.exists(risk_file):
    os.remove(risk_file)
    print("Deleted risk_state.json")
else:
    print("risk_state.json not found")
