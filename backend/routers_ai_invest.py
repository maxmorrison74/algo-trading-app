from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
import google.generativeai as genai
import ccxt
import alpaca_trade_api as tradeapi

# Usa le chiavi condivise da api.py (in produzione andrebbero unificate)
API_KEYS_FILE = os.path.join(os.path.dirname(__file__), ".env.keys")

router = APIRouter(prefix="/api/ai-invest", tags=["ai-invest"])

class ProposalsRequest(BaseModel):
    budget: float

class InvestRequest(BaseModel):
    symbol: str
    asset_type: str # 'stock' o 'crypto'
    amount_usd: float

def get_api_keys():
    keys = {}
    if os.path.exists(API_KEYS_FILE):
        with open(API_KEYS_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    keys[k] = v
    return keys

def get_gemini_client():
    keys = get_api_keys()
    gemini_key = keys.get("GEMINI_KEY") or os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Gemini API Key non configurata")
    genai.configure(api_key=gemini_key)
    return genai.GenerativeModel('gemini-1.5-flash')

@router.post("/proposals")
def get_ai_proposals(req: ProposalsRequest):
    budget = req.budget
    if budget <= 0:
        raise HTTPException(status_code=400, detail="Il budget deve essere maggiore di zero.")
        
    try:
        model = get_gemini_client()
        
        prompt = f"""
Sei un gestore di un Hedge Fund Quantitativo.
Il cliente vuole investire esattamente {budget}$.
Il mercato attuale include Azioni Americane (es. MSFT, TSLA, PLTR) e Criptovalute (es. BTC, SOL).

Devi generare ESATTAMENTE 3 proposte di investimento esclusive per lui:
1. Una proposta 'Safe' (Stock blue-chip o ETF)
2. Una proposta 'Moderate' (Stock Tech in crescita)
3. Una proposta 'Aggressive' (Crypto ad alta volatilità)

Rispondi SOLTANTO con un array JSON in questo esatto formato, senza Markdown o backticks o spiegazioni extra:
[
  {{
    "id": 1,
    "risk": "Conservativo",
    "symbol": "AAPL",
    "asset_type": "stock",
    "title": "Apple Inc - Porto Sicuro",
    "rationale": "Breve spiegazione del perché è sicura oggi."
  }},
  {{
    "id": 2,
    "risk": "Bilanciato",
    ...
  }},
  {{
    "id": 3,
    "risk": "Aggressivo",
    ...
  }}
]
"""
        response = model.generate_content(prompt)
        testo = response.text.strip()
        # Rimuove possibili blocchi markdown
        if testo.startswith("```json"):
            testo = testo.replace("```json", "", 1)
        if testo.endswith("```"):
            testo = testo[:-3]
            
        proposals = json.loads(testo.strip())
        return {"proposals": proposals}
        
    except Exception as e:
        # Fallback in caso di errore AI o rate limit
        print(f"Errore Gemini: {e}")
        return {"proposals": [
            {"id":1, "risk":"Conservativo", "symbol":"MSFT", "asset_type":"stock", "title":"Microsoft Corp", "rationale":"Eccellente bilancio e dominio nell'IA generativa."},
            {"id":2, "risk":"Bilanciato", "symbol":"PLTR", "asset_type":"stock", "title":"Palantir Tech", "rationale":"Forte crescita nei contratti governativi B2B."},
            {"id":3, "risk":"Aggressivo", "symbol":"SOL/USD", "asset_type":"crypto", "title":"Solana", "rationale":"Altissima volatilità e potenziale di breakout."}
        ]}

@router.post("/execute")
def execute_investment(req: InvestRequest):
    keys = get_api_keys()
    
    # 1. LOGICA AZIONI (Alpaca)
    if req.asset_type == 'stock':
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
            return {"status": "success", "message": f"Ordine Notional per {req.amount_usd}$ su {req.symbol} inviato ad Alpaca!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    # 2. LOGICA CRYPTO (Binance tramite CCXT)
    elif req.asset_type == 'crypto':
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
            
            # Formato CCXT standard, es. BTC/USDT (sostituire USD con USDT per Binance)
            symbol_ccxt = req.symbol.replace('/USD', '/USDT')
            
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
            return {"status": "success", "message": f"Esecuzione Crypto PAPER MODE: Comprati {qty:.6f} {symbol_ccxt} per {req.amount_usd}$"}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    raise HTTPException(status_code=400, detail="Asset type non supportato")
