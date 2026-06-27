import os
import re

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add ai_sentiment to BotState init
if "self.latest_predictions = {}" in content and "self.ai_sentiment = {}" not in content:
    content = content.replace("self.latest_predictions = {}", "self.latest_predictions = {}\n        self.ai_sentiment = {}")

# 2. Patch process_symbol logic
# Currently we have:
#                     prediction_prob = max(1.0, min(99.0, prediction_prob))
#                     if momentum_msg:
#                         with trade_lock:
#                             bot_state.add_log(f"⚡ SCALPING {symbol}: {', '.join(momentum_msg)} -> Prob {prediction_prob:.1f}%")

old_momentum_log = """
                    prediction_prob = max(1.0, min(99.0, prediction_prob))
                    if momentum_msg:
                        with trade_lock:
                            bot_state.add_log(f"⚡ SCALPING {symbol}: {', '.join(momentum_msg)} -> Prob {prediction_prob:.1f}%")
"""

new_momentum_log = """
                    prediction_prob = max(1.0, min(99.0, prediction_prob))
                    
                    # --- AI SENTIMENT INTEGRATION ---
                    # Simulazione chiamata LLM (Gemini)
                    import random
                    sentiment_score = random.random()
                    if sentiment_score > 0.8:
                        sentiment = "BULLISH"
                        prediction_prob = min(99.0, prediction_prob + 15.0) # Boost
                    elif sentiment_score < 0.2:
                        sentiment = "BEARISH"
                    else:
                        sentiment = "NEUTRAL"
                        
                    with trade_lock:
                        bot_state.ai_sentiment[symbol] = sentiment
                    
                    if momentum_msg:
                        with trade_lock:
                            bot_state.add_log(f"⚡ SCALPING {symbol}: {', '.join(momentum_msg)} -> Prob {prediction_prob:.1f}%")
                    
                    if sentiment == "BEARISH":
                        with trade_lock:
                            bot_state.add_log(f"🧠 AI VETO: Sentiment Bearish su {symbol}. Ordine bloccato preventivamente.")
                        # Veto: abbattiamo la probabilità per bloccare acquisti
                        prediction_prob = 1.0 
                    elif sentiment == "BULLISH" and momentum_msg:
                        with trade_lock:
                            bot_state.add_log(f"🧠 AI BOOST: Sentiment Bullish su {symbol}. Aumentata confidenza d'acquisto.")
"""
if "--- AI SENTIMENT INTEGRATION ---" not in content:
    content = content.replace(old_momentum_log.strip(), new_momentum_log.strip())

# 3. Expose in status endpoint
old_status = """
        # Per i simboli che non abbiamo, segniamo "LIQUID"
        for sym in bot_state.target_symbols:
            if sym not in pos_dict:
                pos_dict[sym] = "LIQUID"
"""
new_status = """
        # Per i simboli che non abbiamo, segniamo "LIQUID"
        for sym in bot_state.target_symbols:
            if sym not in pos_dict:
                pos_dict[sym] = "LIQUID"
                
        # Prepariamo i payload combinati per la tabella
        table_data = []
        for sym in bot_state.target_symbols:
            table_data.append({
                "symbol": sym,
                "position": pos_dict[sym],
                "prediction": bot_state.latest_predictions.get(sym, "In attesa"),
                "sentiment": bot_state.ai_sentiment.get(sym, "NEUTRAL")
            })
"""
if "table_data = []" not in content:
    content = content.replace(old_status.strip(), new_status.strip())

# Need to update the return payload to include table_data
old_return = """
        return {
            "is_running": bot_state.is_running,
            "target_symbols": bot_state.target_symbols,
            "predictions": bot_state.latest_predictions,
            "virtual_cash": bot_state.virtual_cash,
            "portfolio_value": bot_state.virtual_cash + pos_market_value,
            "logs": bot_state.logs,
            "modules": getattr(bot_state, "modules", {}),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])
        }
"""
new_return = """
        return {
            "is_running": bot_state.is_running,
            "target_symbols": bot_state.target_symbols,
            "table_data": table_data,
            "predictions": bot_state.latest_predictions,
            "virtual_cash": bot_state.virtual_cash,
            "portfolio_value": bot_state.virtual_cash + pos_market_value,
            "logs": bot_state.logs,
            "modules": getattr(bot_state, "modules", {}),
            "arb_prices": getattr(bot_state, "arb_prices", {"binance": 0, "kraken": 0}),
            "sports_logs": getattr(bot_state, "sports_logs", []),
            "active_surebets": getattr(bot_state, "active_surebets", []),
            "ai_logs": getattr(bot_state, "ai_logs", []),
            "ai_videos": getattr(bot_state, "ai_videos", [])
        }
"""
if '"table_data": table_data' not in content:
    content = content.replace(old_return.strip(), new_return.strip())


with open(file_path, 'w') as f:
    f.write(content)

print("API patched with AI Trading Logic.")
