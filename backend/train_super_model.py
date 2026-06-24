import os
import numpy as np
import joblib
from data_loader import fetch_historical_data
from lstm_model import LSTMTradingModel

def main():
    # Per addestrare un "Super Modello" usiamo un paniere diversificato
    # in modo che impari le regole generali del mercato.
    training_symbols = ["SPY", "QQQ", "AAPL", "MSFT", "IWM"]
    
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        
    print(f"{'='*40}")
    print("Inizio Addestramento SUPER MODELLO IA")
    print(f"{'='*40}")
    
    super_model = LSTMTradingModel(sequence_length=60)
    all_X_train, all_y_train = [], []
    all_X_test, all_y_test = [], []
    
    for symbol in training_symbols:
        try:
            print(f"Scaricamento dati per {symbol}...")
            df = fetch_historical_data(symbol, period="5y", interval="1d")
            
            X, y, _ = super_model.prepare_features(df)
            
            # 80% train, 20% test
            train_size = int(len(X) * 0.8)
            all_X_train.append(X[:train_size])
            all_y_train.append(y[:train_size])
            all_X_test.append(X[train_size:])
            all_y_test.append(y[train_size:])
        except Exception as e:
            print(f"Errore con {symbol}: {e}")
            
    # Combiniamo tutte le sequenze in un unico grande dataset
    X_train_final = np.concatenate(all_X_train, axis=0)
    y_train_final = np.concatenate(all_y_train, axis=0)
    X_test_final = np.concatenate(all_X_test, axis=0)
    y_test_final = np.concatenate(all_y_test, axis=0)
    
    # Mischiamo il training set per rompere l'ordine sequenziale per asset
    indices = np.arange(X_train_final.shape[0])
    np.random.shuffle(indices)
    X_train_final = X_train_final[indices]
    y_train_final = y_train_final[indices]
    
    print(f"\nDataset finale pronto: {len(X_train_final)} sequenze di addestramento.")
    
    # Addestriamo il super modello
    super_model.train(X_train_final, y_train_final, epochs=25, batch_size=64)
    super_model.evaluate(X_test_final, y_test_final)
    
    model_path = os.path.join(models_dir, "SUPER_MODEL.keras")
    super_model.save(model_path)
    
    print(f"✅ SUPER MODELLO salvato con successo in {model_path}!")

if __name__ == "__main__":
    main()
