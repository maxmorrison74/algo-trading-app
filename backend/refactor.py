import re
import os

api_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/backend/api.py"
with open(api_path, 'r') as f:
    content = f.read()

# 1. Add imports if not present
if "import concurrent.futures" not in content:
    content = content.replace("import threading\n", "import threading\nimport concurrent.futures\nimport gc\n")

# 2. Extract process_symbol and replace trading_loop
new_trading_logic = """
def process_symbol(symbol, position, current_price):
    global bot_state
    prediction_prob = 50.0
    try:
        if super_model:
            yf_sym = get_yf_symbol(symbol)
            df = fetch_historical_data(yf_sym, period="6mo", interval="1h") # ridotto a 6mo per RAM
            X, _, _ = super_model.prepare_features(df)
            
            y_pred_prob = super_model.predict(X)
            prediction_prob = float(y_pred_prob) * 100
            if math.isnan(prediction_prob):
                prediction_prob = 50.0
                
            # Sentiment
            sentiment_bonus = 0.0
            if sentiment_analyzer:
                try:
                    ticker = yf.Ticker(yf_sym)
                    news = ticker.news
                    if news and len(news) > 0:
                        scores = [sentiment_analyzer.polarity_scores(n['title'])['compound'] for n in news[:5]]
                        if scores:
                            avg_sentiment = sum(scores) / len(scores)
                            sentiment_bonus = avg_sentiment * 15.0
                            prediction_prob += sentiment_bonus
                            prediction_prob = max(1.0, min(99.0, prediction_prob))
                            bot_state.add_log(f"📰 Sentiment {symbol}: {avg_sentiment:+.2f} -> Prob {prediction_prob:.1f}%")
                except Exception as e:
                    pass
            bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% UP"
            
            # GC Aggressive
            del df
            del X
            gc.collect()
            
        else:
            prediction_prob = random.uniform(20.0, 80.0)
            bot_state.latest_predictions[symbol] = f"{prediction_prob:.1f}% (TEST)"
            
        # --- RISK MANAGEMENT: Trailing Stop Loss ---
        if position:
            unrealized_plpc = float(position.unrealized_plpc)
            is_crypto = '/' in symbol
            tif = 'gtc' if is_crypto else 'day'
            
            if symbol not in bot_state.high_watermarks:
                bot_state.high_watermarks[symbol] = current_price
                
            should_sell = False
            if position.side == 'long':
                bot_state.high_watermarks[symbol] = max(bot_state.high_watermarks[symbol], current_price)
                drop_pct = (bot_state.high_watermarks[symbol] - current_price) / bot_state.high_watermarks[symbol]
                if drop_pct >= 0.025: should_sell = True
            else:
                bot_state.high_watermarks[symbol] = min(bot_state.high_watermarks[symbol], current_price)
                rise_pct = (current_price - bot_state.high_watermarks[symbol]) / bot_state.high_watermarks[symbol]
                if rise_pct >= 0.025: should_sell = True
                
            if should_sell:
                alpaca.submit_order(symbol=symbol, qty=position.qty, side='sell' if position.side == 'long' else 'buy', type='market', time_in_force=tif)
                profit_usd = float(position.unrealized_pl)
                bot_state.add_log(f"TRAILING STOP: {symbol} chiuso al {unrealized_plpc*100:.2f}% (${profit_usd:.2f})")
                cash_change = float(position.qty) * current_price
                if position.side == 'long': bot_state.virtual_cash += cash_change
                else: bot_state.virtual_cash -= cash_change
                bot_state.close_trade(symbol, position.side, profit_usd, unrealized_plpc)
                return # Posizione chiusa
        
        # BUY / LONG
        is_crypto = '/' in symbol
        if prediction_prob >= bot_state.aggressiveness:
            pos_side = position.side if position else None
            if pos_side == 'short':
                alpaca.submit_order(symbol=symbol, qty=position.qty, side='buy', type='market', time_in_force='day')
                bot_state.add_log(f"COVER SHORT {position.qty} {symbol} (Prob {prediction_prob:.1f}%)")
                bot_state.virtual_cash -= (float(position.qty) * current_price)
                bot_state.close_trade(symbol, 'short', float(position.unrealized_pl), float(position.unrealized_plpc))
            elif not position or is_crypto:
                confidence = (prediction_prob - bot_state.aggressiveness) / (100.0 - bot_state.aggressiveness) if (100.0 - bot_state.aggressiveness) > 0 else 1.0
                allocation_pct = 0.25 + (0.25 * confidence)
                max_trade_amount = bot_state.virtual_cash * allocation_pct
                if current_price > 0:
                    tif = 'gtc' if is_crypto else 'day'
                    if is_crypto:
                        trade_amount = round(max_trade_amount, 2)
                        if trade_amount >= 1.0 and trade_amount <= bot_state.virtual_cash:
                            alpaca.submit_order(symbol=symbol, notional=trade_amount, side='buy', type='market', time_in_force=tif)
                            bot_state.add_log(f"BUY CRYPTO {trade_amount}$ {symbol} | Prob: {prediction_prob:.1f}%")
                            bot_state.virtual_cash -= trade_amount
                            bot_state.save_state()
                    else:
                        qty_to_buy = math.floor(max_trade_amount / current_price)
                        if qty_to_buy > 0 and (qty_to_buy * current_price) <= bot_state.virtual_cash:
                            alpaca.submit_order(symbol=symbol, qty=qty_to_buy, side='buy', type='market', time_in_force=tif)
                            bot_state.add_log(f"BUY LONG {qty_to_buy} {symbol} | Prob: {prediction_prob:.1f}%")
                            bot_state.virtual_cash -= (qty_to_buy * current_price)
                            bot_state.save_state()
                            
        # SELL / SHORT
        elif prediction_prob <= (100.0 - bot_state.aggressiveness):
            pos_side = position.side if position else None
            is_crypto = '/' in symbol
            tif = 'gtc' if is_crypto else 'day'
            if pos_side == 'long':
                alpaca.submit_order(symbol=symbol, qty=position.qty, side='sell', type='market', time_in_force=tif)
                bot_state.add_log(f"SELL LONG {position.qty} {symbol} (Prob {prediction_prob:.1f}%)")
                bot_state.virtual_cash += (float(position.qty) * current_price)
                bot_state.close_trade(symbol, 'long', float(position.unrealized_pl), float(position.unrealized_plpc))
            elif not position and not is_crypto:
                confidence = ((100.0 - bot_state.aggressiveness) - prediction_prob) / (100.0 - bot_state.aggressiveness) if (100.0 - bot_state.aggressiveness) > 0 else 1.0
                allocation_pct = 0.25 + (0.25 * confidence)
                max_trade_amount = bot_state.virtual_cash * allocation_pct
                if current_price > 0:
                    qty_to_short = math.floor(max_trade_amount / current_price)
                    if qty_to_short > 0:
                        alpaca.submit_order(symbol=symbol, qty=qty_to_short, side='sell', type='market', time_in_force='day')
                        bot_state.add_log(f"SELL SHORT {qty_to_short} {symbol} | Prob: {prediction_prob:.1f}%")
                        bot_state.virtual_cash += (qty_to_short * current_price)
                        bot_state.save_state()
    except Exception as e:
        print(f"Errore process_symbol {symbol}: {e}")
        
def trading_loop():
    print("Inizio ciclo di trading in background (HFT Optimized)...")
    bot_state.add_log("🟢 Scanner HFT Avviato. Il bot è operativo in parallelo.")
    while bot_state.is_running:
        try:
            if alpaca:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Scansione mercato...")
                
                # Screener Dinamico (Bulk se possibile, qui sequenziale veloce)
                if not bot_state.target_symbols:
                    bot_state.add_log("Screener: Ricerca asset <30$...")
                    valid_symbols = []
                    # Cerchiamo di prendere gli ultimi trade in modo efficiente
                    for sym in POOL_TICKERS:
                        try:
                            trade = alpaca.get_latest_trade(sym)
                            if trade.price < 30.0:
                                valid_symbols.append((sym, trade.price))
                        except: pass
                        
                    scanned = ["MRNA"]
                    for s in valid_symbols:
                        if s[0] != "MRNA" and len(scanned) < 5:
                            scanned.append(s[0])
                
                    if scanned:
                        bot_state.target_symbols = scanned
                        bot_state.latest_predictions = {sym: "In attesa" for sym in scanned}
                        bot_state.add_log(f"Screener: Selezionati {', '.join(scanned)}")
                    else:
                        time.sleep(30)
                        continue

                positions = alpaca.list_positions()
                
                # Pre-fetch all prices
                current_prices = {}
                for sym in bot_state.target_symbols:
                    try:
                        current_prices[sym] = alpaca.get_latest_trade(sym).price
                    except:
                        current_prices[sym] = 0.0

                # Multi-Threading per calcolare tutti i target contemporaneamente
                with concurrent.futures.ThreadPoolExecutor(max_workers=len(bot_state.target_symbols)) as executor:
                    futures = []
                    for symbol in bot_state.target_symbols:
                        pos = next((p for p in positions if p.symbol == symbol), None)
                        price = current_prices.get(symbol, 0.0)
                        if price > 0:
                            futures.append(executor.submit(process_symbol, symbol, pos, price))
                    
                    # Aspetta che tutti finiscano
                    concurrent.futures.wait(futures)
                    
                gc.collect()

        except Exception as e:
            print(f"Errore critico nel loop: {e}")
            
        # Riposo
        time.sleep(60)
    
    print("Trading Loop terminato.")
"""

# Replace the old trading_loop
start_idx = content.find("def trading_loop():")
end_idx = content.find("@app.get(\"/api/status\")")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_trading_logic + "\n" + content[end_idx:]
    with open(api_path, 'w') as f:
        f.write(new_content)
    print("Refactor success.")
else:
    print("Failed to find boundaries.")
