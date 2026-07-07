import re

with open("backend/backtest_lstm.py", "r") as f:
    content = f.read()

# Replace run_lstm_backtest body to return dict
new_func = """def run_lstm_backtest(ticker: str = "MRNA", period="4y"):
    print(f"--- Avvio Backtest LSTM per {ticker} ---")
    
    df = fetch_historical_data(ticker, period=period, interval="1d")
    if df.empty:
        return {"error": "Nessun dato trovato"}
    
    sequence_length = 30
    lstm_model = LSTMTradingModel(sequence_length=sequence_length)
    
    X, y, data_clean = lstm_model.prepare_features(df)
    
    split_index = int(len(X) * 0.8)
    X_train, X_test = X[:split_index], X[split_index:]
    y_train, y_test = y[:split_index], y[split_index:]
    
    lstm_model.train(X_train, y_train, epochs=30, batch_size=32)
    predictions = lstm_model.evaluate(X_test, y_test)
    
    test_data = data_clean.iloc[split_index:].copy()
    test_data['Prediction'] = predictions
    
    test_data['Daily_Return'] = test_data['Close'].pct_change()
    test_data = test_data.dropna()
    
    test_data['Strategy_Return'] = test_data['Daily_Return'] * test_data['Prediction'].shift(1)
    test_data = test_data.dropna()
    
    cumulative_market_return = (1 + test_data['Daily_Return']).cumprod() - 1
    cumulative_strategy_return = (1 + test_data['Strategy_Return']).cumprod() - 1
    
    # Prepara dati JSON per il chart front-end
    dates = test_data.index.strftime('%Y-%m-%d').tolist()
    market_curve = (cumulative_market_return * 100).round(2).tolist()
    strategy_curve = (cumulative_strategy_return * 100).round(2).tolist()
    
    final_market = float(market_curve[-1]) if market_curve else 0.0
    final_strategy = float(strategy_curve[-1]) if strategy_curve else 0.0
    
    win_rate = float((test_data['Strategy_Return'] > 0).mean() * 100)
    
    return {
        "ticker": ticker,
        "dates": dates,
        "market_curve": market_curve,
        "strategy_curve": strategy_curve,
        "stats": {
            "market_return_pct": final_market,
            "strategy_return_pct": final_strategy,
            "win_rate_pct": round(win_rate, 2),
            "trades": len(test_data)
        }
    }
"""
content = re.sub(r"def run_lstm_backtest.*?print\(f\"Rendimento Strategia AI: \{final_strategy_return:\.2f\}%\"\)", new_func, content, flags=re.DOTALL)

with open("backend/backtest_lstm.py", "w") as f:
    f.write(content)
