import sys
from data_loader import fetch_historical_data
from model import TradingModel
from sklearn.model_selection import train_test_split

def run_backtest(ticker: str = "MRNA"):
    print(f"--- Avvio Backtest per {ticker} ---")
    
    # 1. Scaricamento dati
    df = fetch_historical_data(ticker, period="2y", interval="1d")
    
    # 2. Inizializzazione Modello
    trading_model = TradingModel()
    
    # 3. Preparazione Feature
    X, y, data_clean = trading_model.prepare_features(df)
    
    # 4. Suddivisione Train/Test (80% training, 20% test sul passato recente)
    # È importante non mescolare casualmente per le serie storiche, il test set deve essere nel futuro rispetto al train set.
    split_index = int(len(X) * 0.8)
    
    X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
    y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]
    
    # 5. Addestramento
    trading_model.train(X_train, y_train)
    
    # 6. Valutazione sul periodo di test
    print("\n--- Risultati sul Test Set ---")
    predictions = trading_model.evaluate(X_test, y_test)
    
    # 7. Simulazione portafoglio base
    # Se la previsione è 1 (sale) compriamo (o teniamo), se è 0 vendiamo
    test_data = data_clean.iloc[split_index:].copy()
    test_data['Prediction'] = predictions
    
    # Calcolo dei rendimenti giornalieri
    test_data['Daily_Return'] = test_data['Close'].pct_change()
    test_data = test_data.dropna()
    
    # Rendimento della strategia (guadagni solo nei giorni in cui il modello prevedeva '1')
    test_data['Strategy_Return'] = test_data['Daily_Return'] * test_data['Prediction'].shift(1)
    test_data = test_data.dropna()
    
    cumulative_market_return = (1 + test_data['Daily_Return']).cumprod() - 1
    cumulative_strategy_return = (1 + test_data['Strategy_Return']).cumprod() - 1
    
    final_market_return = cumulative_market_return.iloc[-1] * 100
    final_strategy_return = cumulative_strategy_return.iloc[-1] * 100
    
    print("\n--- Simulazione Finanziaria ---")
    print(f"Rendimento Buy & Hold (Mercato): {final_market_return:.2f}%")
    print(f"Rendimento Strategia AI: {final_strategy_return:.2f}%")

if __name__ == "__main__":
    run_backtest("MRNA")
