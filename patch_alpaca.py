import re

with open("backend/alpaca_trading.py", "r") as f:
    content = f.read()

# 1. Update Trailing Stop to read from Keys
ts_update = """
        keys_file = os.path.join(os.path.dirname(__file__), ".env.keys")
        global_ts = 2.5
        global_dyn_atr = True
        try:
            with open(keys_file, "r") as f:
                for line in f:
                    if "=" in line:
                        k, v = line.strip().split("=", 1)
                        if k == "TRAILING_STOP_BASE_PCT": global_ts = float(v)
                        elif k == "DYNAMIC_ATR_STOP": global_dyn_atr = (v.lower() == "true")
        except:
            pass

        # Trailing Stop Dinamico
        if global_dyn_atr:
            trail_percent = min(max(atr / current_price * 100 * 1.5, 0.5), 4.0)
        else:
            trail_percent = global_ts
"""
content = re.sub(r"\s*# Trailing Stop Dinamico.*?trail_percent = min\(max\(atr / current_price \* 100 \* 1\.5, 0\.5\), 4\.0\)", ts_update, content, flags=re.DOTALL)


# 2. Add Multi-Timeframe logic before Strategy Veto
mt_logic = """
        # Multi-Timeframe Veto (15m)
        try:
            df_15m = df['close'].resample('15T').last().dropna()
            if len(df_15m) >= 5:
                sma_15m = df_15m.rolling(window=5).mean().iloc[-1]
                macro_trend = "BULLISH" if current_price > sma_15m else "BEARISH"
            else:
                macro_trend = "NEUTRAL"
        except:
            macro_trend = "NEUTRAL"

        # Pattern Recognition & ML Setup (LONG)
"""
content = content.replace("        # Pattern Recognition & ML Setup (LONG)", mt_logic)

# 3. Apply Multi-timeframe Veto inside LONG and SHORT blocks
long_veto = """
        if rsi < 40 and current_macd_hist > 0 and lstm_prob > 0.55:
            if macro_trend == "BEARISH":
                self._log(f"⏱️ MULTI-TIMEFRAME VETO: Setup LONG su {symbol} ma macro trend 15m BEARISH. Ignoro.")
            else:
                side = "LONG"
"""
content = re.sub(r"\s*if rsi < 40 and current_macd_hist > 0 and lstm_prob > 0\.55:\s*side = \"LONG\"", long_veto, content)

short_veto = """
        elif rsi > 60 and current_macd_hist < 0 and lstm_prob < 0.45:
            if macro_trend == "BULLISH":
                self._log(f"⏱️ MULTI-TIMEFRAME VETO: Setup SHORT su {symbol} ma macro trend 15m BULLISH. Ignoro.")
            else:
                side = "SHORT"
"""
content = re.sub(r"\s*elif rsi > 60 and current_macd_hist < 0 and lstm_prob < 0\.45:\s*side = \"SHORT\"", short_veto, content)

with open("backend/alpaca_trading.py", "w") as f:
    f.write(content)
