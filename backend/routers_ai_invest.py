from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
from groq import Groq
import ccxt
import alpaca_trade_api as tradeapi
import yfinance as yf
from auth import require_admin
from fastapi import Depends

# Usa le chiavi condivise da api.py (in produzione andrebbero unificate)
API_KEYS_FILE = os.path.join(os.path.dirname(__file__), ".env.keys")

router = APIRouter(prefix="/api/ai-invest", tags=["ai-invest"])

class ProposalsRequest(BaseModel):
    budget: float
    strategy: str = "balanced"

class InvestRequest(BaseModel):
    symbol: str
    asset_type: str # 'stock' o 'crypto'
    amount_usd: float

def normalize_asset_type(asset_type: str, symbol: str = "") -> str:
    value = (asset_type or "").strip().lower().replace("-", "_").replace(" ", "_")
    if value in {"stock", "stocks", "equity", "equities", "azione", "azioni"}:
        return "stock"
    if value in {"crypto", "cryptocurrency", "cryptocurrencies", "coin", "coins", "token", "tokens", "cripto"}:
        return "crypto"
    symbol_value = (symbol or "").strip().upper()
    if "/" in symbol_value or symbol_value.endswith("USD") or symbol_value.endswith("USDT"):
        return "crypto"
    if value in {"btc", "eth", "sol", "avax", "doge", "link", "shib"}:
        return "crypto"
    return value

def normalize_crypto_symbol(symbol: str) -> str:
    value = (symbol or "").strip().upper()
    if not value:
        return value
    value = value.replace("-USD", "/USD").replace("-USDT", "/USDT")
    if "/" not in value:
        if value.endswith("USDT"):
            base = value[:-4]
            return f"{base}/USDT"
        if value.endswith("USD"):
            base = value[:-3]
            return f"{base}/USD"
        return f"{value}/USDT"
    if value.endswith("/USD"):
        return value.replace("/USD", "/USDT")
    return value

def normalize_display_symbol(symbol: str, asset_type: str = "") -> str:
    raw = (symbol or "").strip().upper()
    normalized_asset_type = normalize_asset_type(asset_type, raw)
    if normalized_asset_type == "crypto":
        crypto_symbol = normalize_crypto_symbol(raw)
        return crypto_symbol.replace("/USDT", "/USD")
    return raw

def sanitize_proposal(item, index: int = 0):
    if not isinstance(item, dict):
        return None
    symbol = str(item.get("symbol") or "").strip()
    asset_type = normalize_asset_type(item.get("asset_type", ""), symbol)
    normalized_symbol = normalize_display_symbol(symbol, asset_type)
    if not normalized_symbol:
        return None
    risk = str(item.get("risk") or "Bilanciato").strip() or "Bilanciato"
    title = str(item.get("title") or normalized_symbol).strip() or normalized_symbol
    rationale = str(item.get("rationale") or "Proposta generata dal motore AI di Aureo.").strip() or "Proposta generata dal motore AI di Aureo."
    proposal_id = item.get("id", index + 1)
    return {
        "id": proposal_id,
        "risk": risk,
        "symbol": normalized_symbol,
        "asset_type": asset_type,
        "title": title,
        "rationale": rationale,
    }

def sanitize_proposals(items):
    normalized = []
    for index, item in enumerate(items or []):
        proposal = sanitize_proposal(item, index=index)
        if proposal:
            normalized.append(proposal)
    return normalized

def get_api_keys():
    keys = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    keys[k] = v
    return keys

def get_groq_client():
    keys = get_api_keys()
    groq_key = keys.get("GROQ_KEY") or os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=500, detail="Groq API Key non configurata")
    
    return Groq(api_key=groq_key)

@router.post("/proposals")
def get_ai_proposals(req: ProposalsRequest):
    budget = req.budget
    strategy = req.strategy
    if budget <= 0:
        raise HTTPException(status_code=400, detail="Il budget deve essere maggiore di zero.")
        
    try:
        model = get_groq_client()
        
        market_data_context = ""
        if strategy == "momentum":
            tickers = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "BTC-USD", "ETH-USD", "SOL-USD"]
            data = yf.download(tickers, period="5d", group_by="ticker")
            market_data_context = "\n=== DATI REALI MERCATO (Ultimi 5 giorni) ===\n"
            for t in tickers:
                try:
                    df = data[t] if len(tickers) > 1 else data
                    if not df.empty:
                        start_price = df['Close'].iloc[0]
                        end_price = df['Close'].iloc[-1]
                        perf = ((end_price - start_price) / start_price) * 100
                        market_data_context += f"- {t}: {perf:.2f}% (Prezzo attuale: {end_price:.2f})\n"
                except Exception:
                    pass
            market_data_context += "========================================\n\nAnalizza i dati qui sopra e individua i 6 asset con il miglior slancio rialzista (Momentum) per le tue proposte."

        prompt = f"""
Sei un gestore di un hedge fund quantitativo.
Il cliente vuole investire esattamente {budget}$.
Il mercato attuale include azioni americane e criptovalute.
{market_data_context}

Genera esattamente 6 proposte:
1. Due conservative
2. Due bilanciate
3. Due aggressive

Rispondi solo con un oggetto JSON valido, senza markdown, con questa forma:
{{
  "proposals": [
    {{
      "id": 1,
      "risk": "Conservativo",
      "symbol": "AAPL",
      "asset_type": "stock",
      "title": "Apple Inc - Porto Sicuro",
      "rationale": "Breve spiegazione del perché è sicura oggi."
    }}
  ]
}}
"""
        response = model.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )
        result_text = response.choices[0].message.content
        
        # Parse output as JSON
        proposals = json.loads(result_text)
        if "proposals" in proposals:
            proposals = proposals["proposals"]
        return {"proposals": sanitize_proposals(proposals)}
        
    except Exception as e:
        # Fallback in caso di errore AI o rate limit
        print(f"Errore Groq: {e}")
        
        if req.strategy == "momentum":
            return {"proposals": sanitize_proposals([
                {"id":1, "risk":"Conservativo", "symbol":"AAPL", "asset_type":"stock", "title":"Apple Inc", "rationale":"Forte momentum rialzista nell'ultimo periodo."},
                {"id":2, "risk":"Conservativo", "symbol":"META", "asset_type":"stock", "title":"Meta Platforms", "rationale":"Trend solido con aumento degli utili."},
                {"id":3, "risk":"Bilanciato", "symbol":"NVDA", "asset_type":"stock", "title":"NVIDIA Corp", "rationale":"Leader indiscusso spinto dal boom AI."},
                {"id":4, "risk":"Bilanciato", "symbol":"TSLA", "asset_type":"stock", "title":"Tesla", "rationale":"Recupero recente dopo cali significativi."},
                {"id":5, "risk":"Aggressivo", "symbol":"BTC/USD", "asset_type":"crypto", "title":"Bitcoin", "rationale":"Spinta inflazionistica e volumi record."},
                {"id":6, "risk":"Aggressivo", "symbol":"ETH/USD", "asset_type":"crypto", "title":"Ethereum", "rationale":"Adozione layer-2 in accelerazione."}
            ])}
            
        return {"proposals": sanitize_proposals([
            {"id":1, "risk":"Conservativo", "symbol":"MSFT", "asset_type":"stock", "title":"Microsoft Corp", "rationale":"Eccellente bilancio e dominio nell'IA generativa."},
            {"id":2, "risk":"Conservativo", "symbol":"JNJ", "asset_type":"stock", "title":"Johnson & Johnson", "rationale":"Dividendi stabili e settore difensivo."},
            {"id":3, "risk":"Bilanciato", "symbol":"PLTR", "asset_type":"stock", "title":"Palantir Tech", "rationale":"Forte crescita nei contratti governativi B2B."},
            {"id":4, "risk":"Bilanciato", "symbol":"CRWD", "asset_type":"stock", "title":"CrowdStrike", "rationale":"Leader indiscusso nella cybersecurity cloud."},
            {"id":5, "risk":"Aggressivo", "symbol":"SOL/USD", "asset_type":"crypto", "title":"Solana", "rationale":"Altissima volatilità e potenziale di breakout ecosistema."},
            {"id":6, "risk":"Aggressivo", "symbol":"AVAX/USD", "asset_type":"crypto", "title":"Avalanche", "rationale":"Rete veloce in rapida espansione nel gaming Web3."}
        ])}

@router.post("/execute")
def execute_investment(req: InvestRequest, _: str = Depends(require_admin)):
    from api import bot_state
    from datetime import datetime
    keys = get_api_keys()
    asset_type = normalize_asset_type(req.asset_type, req.symbol)
    
    # 1. LOGICA AZIONI (Alpaca)
    if asset_type == 'stock':
        api_key = keys.get("ALPACA_KEY") or os.getenv("ALPACA_API_KEY")
        api_secret = keys.get("ALPACA_SECRET") or os.getenv("ALPACA_SECRET_KEY")
        base_url = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
        
        if not api_key:
            raise HTTPException(status_code=500, detail="Chiavi Alpaca mancanti")
            
        try:
            alpaca = tradeapi.REST(api_key, api_secret, base_url, api_version='v2')
            # Notional order (acquista per importo in dollari esatto)
            alpaca.submit_order(
                symbol=req.symbol,
                notional=req.amount_usd,
                side='buy',
                type='market',
                time_in_force='day'
            )
            
            if not hasattr(bot_state, "ai_investments"):
                bot_state.ai_investments = []
            
            bot_state.ai_investments.insert(0, {
                "symbol": req.symbol,
                "asset_type": asset_type,
                "amount_usd": req.amount_usd,
                "platform": "Alpaca",
                "timestamp": datetime.now().strftime("%H:%M:%S")
            })
            bot_state.save_state()
            
            return {"status": "success", "message": f"Ordine Notional per {req.amount_usd}$ su {req.symbol} inviato ad Alpaca!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    # 2. LOGICA CRYPTO (Binance tramite CCXT)
    elif asset_type == 'crypto':
        api_key = keys.get("BINANCE_KEY")
        api_secret = keys.get("BINANCE_SECRET")
        if not api_key:
             raise HTTPException(status_code=500, detail="Chiavi Binance mancanti")
             
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
            })
            
            symbol_ccxt = normalize_crypto_symbol(req.symbol)
            
            # Recupera prezzo di mercato
            ticker = exchange.fetch_ticker(symbol_ccxt)
            current_price = ticker['last']
            if not current_price:
                 raise Exception("Impossibile recuperare il prezzo attuale.")
                 
            # Calcola size
            qty = req.amount_usd / current_price
            
            # Testnet / Paper execution (commenta per soldi veri)
            # exchange.set_sandbox_mode(True)
            
            # Creazione ordine reale
            # order = exchange.create_market_buy_order(symbol_ccxt, qty)
            
            # Simulazione sicura (Dato che l'utente sta usando testnet per l'arbitraggio, simuliamo qui a meno che non forzino)
            
            if not hasattr(bot_state, "ai_investments"):
                bot_state.ai_investments = []
            
            bot_state.ai_investments.insert(0, {
                "symbol": symbol_ccxt,
                "asset_type": asset_type,
                "amount_usd": req.amount_usd,
                "platform": "Binance (Paper)",
                "timestamp": datetime.now().strftime("%H:%M:%S")
            })
            bot_state.save_state()
            
            return {"status": "success", "message": f"Esecuzione Crypto PAPER MODE: Comprati {qty:.6f} {symbol_ccxt} per {req.amount_usd}$"}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    raise HTTPException(status_code=400, detail="Asset type non supportato")

class CancelInvestmentRequest(BaseModel):
    index: int
    symbol: str
    platform: str

@router.post("/cancel")
def cancel_investment(req: CancelInvestmentRequest, _: str = Depends(require_admin)):
    from api import bot_state
    keys = get_api_keys()
    
    # Se l'ordine è su Alpaca, proviamo a cancellarlo dalle API (se il mercato era chiuso, sarà in stato 'open' o 'new')
    if req.platform.lower() == 'alpaca':
        api_key = keys.get("ALPACA_KEY") or os.getenv("ALPACA_API_KEY")
        api_secret = keys.get("ALPACA_SECRET") or os.getenv("ALPACA_SECRET_KEY")
        base_url = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
        if api_key:
            try:
                import alpaca_trade_api as tradeapi
                alpaca = tradeapi.REST(api_key, api_secret, base_url, api_version='v2')
                open_orders = alpaca.list_orders(status='open', symbols=[req.symbol])
                for order in open_orders:
                    alpaca.cancel_order(order.id)
            except Exception as e:
                print(f"Errore cancellazione ordine Alpaca per {req.symbol}:", e)
                
    # Rimuovi dal registro locale
    if hasattr(bot_state, "ai_investments") and 0 <= req.index < len(bot_state.ai_investments):
        inv = bot_state.ai_investments[req.index]
        if inv["symbol"] == req.symbol:
            bot_state.ai_investments.pop(req.index)
            bot_state.save_state()
            return {"status": "success", "message": f"Investimento su {req.symbol} annullato con successo."}
            
    raise HTTPException(status_code=404, detail="Investimento non trovato nel registro.")
