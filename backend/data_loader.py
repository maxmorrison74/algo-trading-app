import yfinance as yf
import pandas as pd
import numpy as np

def fetch_historical_data(ticker_symbol: str, period: str = "2y", interval: str = "1h") -> pd.DataFrame:
    """
    Scarica i dati storici per un dato ticker da Yahoo Finance.
    """
    print(f"Scaricamento dati per {ticker_symbol} (periodo: {period}, intervallo: {interval})...")
    ticker = yf.Ticker(ticker_symbol)
    df = ticker.history(period=period, interval=interval)
    
    if df.empty:
        raise ValueError(f"Nessun dato trovato per il ticker {ticker_symbol}")
        
    # Calcolo di indicatori tecnici basilari per il modello
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    
    # Calcolo RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # Volatility (deviazione standard a 20 giorni)
    df['Volatility'] = df['Close'].rolling(window=20).std()
    
    # Rimuoviamo le righe con valori nulli dovuti alle finestre di calcolo (rolling)
    df = df.dropna()
    
    print(f"Dati preparati: {len(df)} record totali.")
    return df

if __name__ == "__main__":
    # Test della funzione
    df_mrna = fetch_historical_data("MRNA", period="2y", interval="1d")
    print(df_mrna.tail())
    # Salviamo i dati in un CSV per ispezione
    df_mrna.to_csv("mrna_historical.csv")
    print("Dati salvati in mrna_historical.csv")
