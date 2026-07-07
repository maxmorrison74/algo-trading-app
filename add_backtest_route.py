import re

with open("backend/api.py", "r") as f:
    content = f.read()

route = """
class BacktestRequest(BaseModel):
    ticker: str = "AAPL"
    period: str = "4y"

@app.post("/api/backtest")
def api_run_backtest(req: BacktestRequest, user: dict = Depends(require_user)):
    from backtest_lstm import run_lstm_backtest
    try:
        results = run_lstm_backtest(ticker=req.ticker, period=req.period)
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}

"""
# Find a good place to insert it, like before @app.post("/api/keys")
content = content.replace("@app.post(\"/api/keys\")", route + "@app.post(\"/api/keys\")")

with open("backend/api.py", "w") as f:
    f.write(content)
