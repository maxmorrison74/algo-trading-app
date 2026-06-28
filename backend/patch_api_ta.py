import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

old_ta = """        # Prevediamo su base storica
        df = fetch_historical_data(yf_symbol, start_date=start_str, end_date=end_str)
        if len(df) > 60:
            X, _ = ai_model.preprocess_data(df)"""

new_ta = """        # Prevediamo su base storica estesa per calcolare Medie Mobili e RSI
        start_extended = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        df = fetch_historical_data(yf_symbol, start_date=start_extended, end_date=end_str)
        if len(df) > 60:
            # Calcolo Indicatori Analisi Tecnica (TA) Base Pandas
            # EMA 50 & 200
            df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
            df['EMA_200'] = df['Close'].ewm(span=200, adjust=False).mean()
            
            # MACD
            df['MACD'] = df['Close'].ewm(span=12, adjust=False).mean() - df['Close'].ewm(span=26, adjust=False).mean()
            df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
            
            # RSI (14 periodi) - Wilder's Moving Average approximation
            delta = df['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            current_rsi = df['RSI'].iloc[-1]
            current_macd = df['MACD'].iloc[-1]
            current_macd_signal = df['MACD_Signal'].iloc[-1]
            
            X, _ = ai_model.preprocess_data(df)"""

content = content.replace(old_ta, new_ta)

old_prediction = """            try:
                prediction_prob = float(ai_model.model.predict(X_infer, verbose=0)[0][0]) * 100
                
                # Sentiment Analysis
                sentiment_score = analyze_sentiment(symbol)
                # Modula la probabilità basata sul sentiment
                prediction_prob += (sentiment_score * 10.0) # Sentiment range -1 to +1 -> +/- 10%

                bot_state.add_log(f"🧠 IA {symbol}: Probabilità {prediction_prob:.1f}% (Sentiment: {sentiment_score:.2f})")
            except Exception as e:
                prediction_prob = random.uniform(30.0, 70.0)
                bot_state.add_log(f"⚠️ Errore AI su {symbol}, probabilità random (mock): {prediction_prob:.1f}%")

            with trade_lock:
                bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% UP" """

new_prediction = """            try:
                ai_prob = float(ai_model.model.predict(X_infer, verbose=0)[0][0]) * 100
                
                # Sentiment Analysis
                sentiment_score = analyze_sentiment(symbol)
                
                # Punteggio Ponderato (Ensemble Strategy)
                # Partiamo dalla probabilità dell'IA modulata dal Sentiment
                base_prob = ai_prob + (sentiment_score * 10.0)
                
                ta_bonus = 0.0
                
                # MACD Trend Filter
                if current_macd > current_macd_signal:
                    ta_bonus += 5.0 # Trend rialzista confermato
                else:
                    ta_bonus -= 5.0 # Trend ribassista
                    
                # RSI Mean Reversion Filter
                if current_rsi < 30:
                    ta_bonus += 15.0 # Forte ipervenduto, probabile rimbalzo (Mean Reversion)
                elif current_rsi > 70:
                    ta_bonus -= 15.0 # Forte ipercomprato, probabile storno
                    
                prediction_prob = base_prob + ta_bonus
                # Clamp tra 0 e 100
                prediction_prob = max(0.0, min(100.0, prediction_prob))

                bot_state.add_log(f"🧠 Ensemble {symbol}: {prediction_prob:.1f}% (AI:{ai_prob:.1f}% RSI:{current_rsi:.1f} MACD:{'UP' if current_macd > current_macd_signal else 'DOWN'})")
            except Exception as e:
                prediction_prob = random.uniform(30.0, 70.0)
                current_rsi = 50.0
                bot_state.add_log(f"⚠️ Errore AI su {symbol}, mock: {prediction_prob:.1f}%")

            with trade_lock:
                trend_str = "🟢" if current_macd > current_macd_signal else "🔴"
                rsi_str = "🔥" if current_rsi > 70 else "❄️" if current_rsi < 30 else "📊"
                bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% | RSI:{current_rsi:.0f}{rsi_str} | MACD:{trend_str}" """

content = content.replace(old_prediction, new_prediction)

with open(file_path, 'w') as f:
    f.write(content)
print("api.py trading strategies patched")
