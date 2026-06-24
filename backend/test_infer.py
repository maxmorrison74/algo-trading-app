import sys
from data_loader import fetch_historical_data
from lstm_model import LSTMTradingModel

super_model = LSTMTradingModel()
super_model.load("models/SUPER_MODEL.keras")

symbol = "MRNA"
df = fetch_historical_data(symbol, period="6mo", interval="1d")
X, _, _ = super_model.prepare_features(df)
print("X shape:", X.shape)
