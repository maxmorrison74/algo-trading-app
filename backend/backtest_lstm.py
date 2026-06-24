import sys
from data_loader import fetch_historical_data
from lstm_model import LSTMTradingModel
import numpy as np
import tensorflow as tf

# Impostiamo i seed per rendere i risultati minimamente riproducibili (anche se GPU/CPU differiscono)
np.random.seed(42)
tf.random.set_seed(42)

def run_lstm_backtest(ticker: str = "MRNA"):
    print(f"--- Avvio Backtest LSTM per {ticker} ---")
    
    # 1. Scaricamento dati (Aumentiamo il periodo a 4 anni per dare più dati alla rete neurale)
    df = fetch_historical_data(ticker, period="4y", interval="1d")
    
    # 2. Inizializzazione Modello LSTM (sequenze da 30 giorni)
    sequence_length = 30
    lstm_model = LSTMTradingModel(sequence_length=sequence_length)
    
    # 3. Preparazione Feature (Inclusi MACD e Bollinger Bands)
    X, y, data_clean = lstm_model.prepare_features(df)
    
    # 4. Suddivisione Train/Test (80% training, 20% test)
    split_index = int(len(X) * 0.8)
    
    X_train, X_test = X[:split_index], X[split_index:]
    y_train, y_test = y[:split_index], y[split_index:]
    
    # 5. Addestramento
    lstm_model.train(X_train, y_train, epochs=30, batch_size=32)
    
    # 6. Valutazione
    print("\n--- Risultati sul Test Set ---")
    predictions = lstm_model.evaluate(X_test, y_test)
    
    # 7. Simulazione portafoglio base
    test_data = data_clean.iloc[split_index:].copy()
    test_data['Prediction'] = predictions
    
    test_data['Daily_Return'] = test_data['Close'].pct_change()
    test_data = test_data.dropna()
    
    # Regola: se prediciamo 1 stiamo nel mercato, se 0 stiamo liquidi
    test_data['Strategy_Return'] = test_data['Daily_Return'] * test_data['Prediction'].shift(1)
    test_data = test_data.dropna()
    
    cumulative_market_return = (1 + test_data['Daily_Return']).cumprod() - 1
    cumulative_strategy_return = (1 + test_data['Strategy_Return']).cumprod() - 1
    
    final_market_return = cumulative_market_return.iloc[-1] * 100
    final_strategy_return = cumulative_strategy_return.iloc[-1] * 100
    
    print("\n--- Simulazione Finanziaria (LSTM) ---")
    print(f"Rendimento Buy & Hold (Mercato): {final_market_return:.2f}%")
    print(f"Rendimento Strategia AI: {final_strategy_return:.2f}%")

if __name__ == "__main__":
    # Disabilitiamo i warning fastidiosi di TensorFlow per il log
    import os
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
    run_lstm_backtest("MRNA")
