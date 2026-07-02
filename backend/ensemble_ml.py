import os
import numpy as np
import pandas as pd
from lstm_model import LSTMTradingModel
import joblib

class EnsembleTradingModel:
    """
    Ensemble Machine Learning Model
    Combines LSTM (Sequential Patterns) and Random Forest / XGBoost (Feature-based)
    """
    def __init__(self):
        self.lstm = LSTMTradingModel()
        self.rf_model = None
        self.weights = {"lstm": 0.65, "rf": 0.35}

    def load(self, filepath):
        """
        Loads the LSTM model, and attempts to load an associated Random Forest .pkl
        """
        self.lstm.load(filepath)
        
        # Try to load RF model if exists
        rf_path = filepath.replace(".keras", "_rf.pkl")
        if os.path.exists(rf_path):
            try:
                self.rf_model = joblib.load(rf_path)
            except Exception as e:
                print(f"Errore caricamento RF: {e}")
                self.rf_model = None

    def predict_proba(self, df):
        """
        Calculates weighted prediction from LSTM and RF.
        """
        # 1. Get LSTM Prediction
        p_lstm = self.lstm.predict_proba(df)
        
        # Se c'è un errore o dati insufficienti per LSTM (che ritorna 0.5 di default)
        if p_lstm == 0.5:
            return 0.5
            
        # 2. Get Random Forest Prediction (Mock/Fallback se non addestrato)
        p_rf = 0.5
        if self.rf_model is not None:
            # TODO: Extract features for real RF
            pass
        else:
            # Regime Classifier semplificato basato sul Momentum
            if len(df) >= 20:
                close = float(df['close'].iloc[-1])
                sma20 = float(df['close'].rolling(20).mean().iloc[-1])
                p_rf = 0.7 if close > sma20 else 0.3
                
        # 3. Ensemble (Media Ponderata)
        final_prob = (p_lstm * self.weights["lstm"]) + (p_rf * self.weights["rf"])
        return final_prob
