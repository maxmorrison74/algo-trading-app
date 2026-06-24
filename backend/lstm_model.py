import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import accuracy_score, classification_report
import tensorflow as tf
from tensorflow.keras.models import Sequential # type: ignore
from tensorflow.keras.layers import LSTM, Dense, Dropout # type: ignore

class LSTMTradingModel:
    def __init__(self, sequence_length=60):
        self.sequence_length = sequence_length
        self.scaler_X = MinMaxScaler()
        self.model = None

    def save(self, filepath):
        if self.model:
            self.model.save(filepath)
            # Salvataggio del MinMax scaler (semplificato qui, per un uso avanzato si usa joblib)
            import joblib
            joblib.dump(self.scaler_X, filepath.replace('.keras', '_scaler.pkl'))

    def load(self, filepath):
        from tensorflow.keras.models import load_model # type: ignore
        import joblib
        self.model = load_model(filepath)
        self.scaler_X = joblib.load(filepath.replace('.keras', '_scaler.pkl'))

    def create_sequences(self, X_data, y_data):
        X, y = [], []
        for i in range(len(X_data) - self.sequence_length):
            X.append(X_data[i:(i + self.sequence_length)])
            y.append(y_data[i + self.sequence_length])
        return np.array(X), np.array(y)

    def prepare_features(self, df: pd.DataFrame):
        data = df.copy()
        
        # Aggiungiamo MACD e Bande di Bollinger come nuove feature
        # MACD
        exp1 = data['Close'].ewm(span=12, adjust=False).mean()
        exp2 = data['Close'].ewm(span=26, adjust=False).mean()
        data['MACD'] = exp1 - exp2
        data['Signal_Line'] = data['MACD'].ewm(span=9, adjust=False).mean()
        
        # Bollinger Bands
        data['BB_Middle'] = data['Close'].rolling(window=20).mean()
        std_dev = data['Close'].rolling(window=20).std()
        data['BB_Upper'] = data['BB_Middle'] + (std_dev * 2)
        data['BB_Lower'] = data['BB_Middle'] - (std_dev * 2)
        
        # Variabile Target (y): 1 se il prezzo sale domani, 0 se scende
        data['Target'] = np.where(data['Close'].shift(-1) > data['Close'], 1, 0)
        
        # Rimozione NaN derivati dai calcoli
        data = data.dropna()
        
        # Feature per l'LSTM
        features = ['Open', 'High', 'Low', 'Close', 'Volume', 'SMA_20', 'SMA_50', 'RSI', 'MACD', 'BB_Upper', 'BB_Lower']
        
        X_raw = data[features].values
        y_raw = data['Target'].values
        
        # Normalizzazione: fondamentale per le reti neurali
        X_scaled = self.scaler_X.fit_transform(X_raw)
        
        # Creazione sequenze (3D array: samples, time_steps, features)
        X_seq, y_seq = self.create_sequences(X_scaled, y_raw)
        
        # Per far combaciare y con il data_clean che ritorniamo (per il backtest)
        # tagliamo i primi `sequence_length` record dal dataframe
        data_clean = data.iloc[self.sequence_length:].copy()
        
        return X_seq, y_seq, data_clean

    def build_model(self, input_shape):
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(25, activation='relu'),
            Dense(1, activation='sigmoid') # Sigmoid per classificazione binaria (0 o 1)
        ])
        
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        self.model = model

    def train(self, X_train, y_train, epochs=20, batch_size=32):
        print(f"Addestramento Rete Neurale LSTM (Shape input: {X_train.shape})...")
        if self.model is None:
            self.build_model((X_train.shape[1], X_train.shape[2]))
            
        self.model.fit(X_train, y_train, epochs=epochs, batch_size=batch_size, verbose=1, validation_split=0.1)
        print("Addestramento completato.")

    def evaluate(self, X_test, y_test):
        # Previsione probabilità
        y_pred_prob = self.model.predict(X_test)
        # Convertiamo le probabilità in 0 o 1 (soglia 0.5)
        predictions = (y_pred_prob > 0.5).astype(int).flatten()
        
        accuracy = accuracy_score(y_test, predictions)
        print(f"Accuratezza del modello LSTM: {accuracy * 100:.2f}%")
        print("\nReport di Classificazione:")
        print(classification_report(y_test, predictions))
        
        return predictions

    def predict(self, X):
        # verbose=0 evita crash (math domain error) per progress bar su batch piccoli in Keras
        y_pred_prob = self.model.predict(X, verbose=0)
        # Ritorniamo la probabilità (0-1), api.py moltiplicherà per 100
        return float(y_pred_prob[-1][0])
