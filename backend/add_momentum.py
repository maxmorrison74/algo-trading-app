import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

rsi_func = """
def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))
"""

if "def calculate_rsi" not in content:
    content = content.replace("def process_symbol", rsi_func + "\ndef process_symbol")

momentum_logic = """
            # --- MOMENTUM & SCALPING (5-min timeframe) ---
            try:
                df_short = yf.download(yf_sym, period="5d", interval="5m", progress=False)
                if not df_short.empty and len(df_short) > 20:
                    # RSI 5-min
                    rsi_series = calculate_rsi(df_short['Close'], period=14)
                    current_rsi = rsi_series.iloc[-1].item() if isinstance(rsi_series.iloc[-1], pd.Series) else rsi_series.iloc[-1]
                    
                    # Volume Spike
                    recent_vol = df_short['Volume'].iloc[-1].item() if isinstance(df_short['Volume'].iloc[-1], pd.Series) else df_short['Volume'].iloc[-1]
                    avg_vol = df_short['Volume'].iloc[-21:-1].mean()
                    avg_vol = avg_vol.item() if isinstance(avg_vol, pd.Series) else avg_vol
                    
                    current_close = df_short['Close'].iloc[-1].item() if isinstance(df_short['Close'].iloc[-1], pd.Series) else df_short['Close'].iloc[-1]
                    prev_close = df_short['Close'].iloc[-2].item() if isinstance(df_short['Close'].iloc[-2], pd.Series) else df_short['Close'].iloc[-2]
                    
                    momentum_msg = []
                    
                    if not pd.isna(current_rsi):
                        if current_rsi < 30:
                            prediction_prob += 20.0
                            momentum_msg.append(f"RSI Iper-Venduto ({current_rsi:.1f})")
                        elif current_rsi > 70:
                            prediction_prob -= 20.0
                            momentum_msg.append(f"RSI Iper-Comprato ({current_rsi:.1f})")
                            
                    if avg_vol > 0 and recent_vol > (avg_vol * 3):
                        if current_close > prev_close:
                            prediction_prob += 20.0
                            momentum_msg.append(f"Volume Spike UP ({recent_vol/avg_vol:.1f}x)")
                        else:
                            prediction_prob -= 20.0
                            momentum_msg.append(f"Volume Spike DOWN ({recent_vol/avg_vol:.1f}x)")
                            
                    prediction_prob = max(1.0, min(99.0, prediction_prob))
                    if momentum_msg:
                        with trade_lock:
                            bot_state.add_log(f"⚡ SCALPING {symbol}: {', '.join(momentum_msg)} -> Prob {prediction_prob:.1f}%")
                            
                del df_short
            except Exception as e:
                print(f"Errore momentum {symbol}: {e}")
"""

if "MOMENTUM & SCALPING" not in content:
    # Insert right before "with trade_lock:" of latest_predictions
    target = "            with trade_lock:\n                bot_state.latest_predictions[symbol] = f\"{prediction_prob:.1f}% UP\""
    content = content.replace(target, momentum_logic + "\n" + target)

import pandas as pd
if "import pandas as pd" not in content:
    content = content.replace("import yfinance as yf\n", "import yfinance as yf\nimport pandas as pd\n")

with open(api_path, 'w') as f:
    f.write(content)
print("Momentum strategy applied.")
