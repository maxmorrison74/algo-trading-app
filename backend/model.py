import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import numpy as np

class TradingModel:
    def __init__(self):
        # Utilizziamo una Random Forest come modello predittivo di base
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        
    def prepare_features(self, df: pd.DataFrame):
        """
        Prepara le feature (X) e la variabile target (y).
        Il target è 1 se il prezzo di chiusura del giorno successivo è maggiore di quello odierno, 0 altrimenti.
        """
        # Creiamo una copia per non modificare il dataframe originale
        data = df.copy()
        
        # Variabile Target (y): 1 se il prezzo sale domani, 0 se scende
        data['Target'] = np.where(data['Close'].shift(-1) > data['Close'], 1, 0)
        
        # Rimuoviamo l'ultima riga poiché non abbiamo il target per "domani"
        data = data.dropna()
        
        # Selezioniamo le feature per l'addestramento
        # Evitiamo di dare il 'Close' assoluto al modello (può causare overfitting), 
        # meglio usare le variazioni percentuali o gli indicatori
        features = ['SMA_20', 'SMA_50', 'RSI', 'Volatility']
        
        X = data[features]
        y = data['Target']
        
        return X, y, data
        
    def train(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Addestra il modello."""
        print("Addestramento del modello Random Forest in corso...")
        self.model.fit(X_train, y_train)
        print("Addestramento completato.")
        
    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series):
        """Valuta le prestazioni del modello sui dati di test."""
        predictions = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, predictions)
        print(f"Accuratezza del modello: {accuracy * 100:.2f}%")
        print("\nReport di Classificazione:")
        print(classification_report(y_test, predictions))
        return predictions
        
    def predict(self, X: pd.DataFrame):
        """Effettua previsioni su nuovi dati."""
        return self.model.predict(X)
