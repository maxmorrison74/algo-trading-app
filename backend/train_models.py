import os
import joblib
from data_loader import fetch_historical_data
from lstm_model import LSTMTradingModel

def main():
    target_symbols = ["NVDA", "TSLA", "AAPL", "AMD", "MRNA"]
    
    # Crea cartella models se non esiste
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        
    for symbol in target_symbols:
        print(f"\n{'='*40}")
        print(f"Inizio Addestramento IA per: {symbol}")
        print(f"{'='*40}")
        
        try:
            # 1. Scarica ultimi 5 anni di dati (per avere un training set sostanzioso)
            df = fetch_historical_data(symbol, period="5y", interval="1d")
            
            # 2. Inizializza Modello LSTM
            # Usiamo sequence_length = 60 (giorni) per guardare agli ultimi 2 mesi di dati
            ai_model = LSTMTradingModel(sequence_length=60)
            
            # 3. Prepara feature (MACD, Bollinger, RSI, ecc.)
            X, y, df_clean = ai_model.prepare_features(df)
            
            # Selezioniamo gli ultimi 100 giorni per il test, il resto per il training
            train_size = len(X) - 100
            X_train, y_train = X[:train_size], y[:train_size]
            X_test, y_test = X[train_size:], y[train_size:]
            
            # 4. Addestra (epochs=20 per velocità, nella realtà magari 50+)
            ai_model.train(X_train, y_train, epochs=20, batch_size=32)
            
            # 5. Valuta modello
            ai_model.evaluate(X_test, y_test)
            
            # 6. Salva pesi ed elaboratore scalare
            model_path = os.path.join(models_dir, f"{symbol}_model.keras")
            ai_model.save(model_path)
            
            print(f"✅ Modello per {symbol} salvato con successo in {model_path}!")
            
        except Exception as e:
            print(f"❌ Errore durante l'addestramento di {symbol}: {e}")

if __name__ == "__main__":
    main()
