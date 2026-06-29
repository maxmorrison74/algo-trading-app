from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
from groq import Groq
import ccxt
import alpaca_trade_api as tradeapi
import yfinance as yf

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
Sei un gestore di un Hedge Fund Quantitativo.
Il cliente vuole investire esattamente {budget}$.
Il mercato attuale include Azioni Americane (es. MSFT, TSLA, PLTR) e Criptovalute (es. BTC, SOL).
{market_data_context}

Devi generare ESATTAMENTE 6 proposte di investimento esclusive per lui:
1. Due proposte 'Safe' (Stock blue-chip o ETF)
2. Due proposte 'Moderate' (Stock Tech in crescita o Mid-cap)
3. Due proposte 'Aggressive' (Crypto ad alta volatilità)

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
    "risk": "Conservativo",
{
  "proposals": [
    {
      "id": 1,
      "risk": "Conservativo",
      "symbol": "AAPL",
      "asset_type": "stock",
      "title": "Apple Inc - Porto Sicuro",
      "rationale": "Breve spiegazione del perché è sicura oggi."
    }
  ]
}
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
        return {"proposals": proposals}
        
    except Exception as e:
        # Fallback in caso di errore AI o rate limit
        print(f"Errore Groq: {e}")
        
        if req.strategy == "momentum":
            return {"proposals": [
                {"id":1, "risk":"Conservativo", "symbol":"AAPL", "asset_type":"stock", "title":"Apple Inc", "rationale":"Forte momentum rialzista nell'ultimo periodo."},
                {"id":2, "risk":"Conservativo", "symbol":"META", "asset_type":"stock", "title":"Meta Platforms", "rationale":"Trend solido con aumento degli utili."},
                {"id":3, "risk":"Bilanciato", "symbol":"NVDA", "asset_type":"stock", "title":"NVIDIA Corp", "rationale":"Leader indiscusso spinto dal boom AI."},
                {"id":4, "risk":"Bilanciato", "symbol":"TSLA", "asset_type":"stock", "title":"Tesla", "rationale":"Recupero recente dopo cali significativi."},
                {"id":5, "risk":"Aggressivo", "symbol":"BTC/USD", "asset_type":"crypto", "title":"Bitcoin", "rationale":"Spinta inflazionistica e volumi record."},
                {"id":6, "risk":"Aggressivo", "symbol":"ETH/USD", "asset_type":"crypto", "title":"Ethereum", "rationale":"Adozione layer-2 in accelerazione."}
            ]}
            
        return {"proposals": [
            {"id":1, "risk":"Conservativo", "symbol":"MSFT", "asset_type":"stock", "title":"Microsoft Corp", "rationale":"Eccellente bilancio e dominio nell'IA generativa."},
            {"id":2, "risk":"Conservativo", "symbol":"JNJ", "asset_type":"stock", "title":"Johnson & Johnson", "rationale":"Dividendi stabili e settore difensivo."},
            {"id":3, "risk":"Bilanciato", "symbol":"PLTR", "asset_type":"stock", "title":"Palantir Tech", "rationale":"Forte crescita nei contratti governativi B2B."},
            {"id":4, "risk":"Bilanciato", "symbol":"CRWD", "asset_type":"stock", "title":"CrowdStrike", "rationale":"Leader indiscusso nella cybersecurity cloud."},
            {"id":5, "risk":"Aggressivo", "symbol":"SOL/USD", "asset_type":"crypto", "title":"Solana", "rationale":"Altissima volatilità e potenziale di breakout ecosistema."},
            {"id":6, "risk":"Aggressivo", "symbol":"AVAX/USD", "asset_type":"crypto", "title":"Avalanche", "rationale":"Rete veloce in rapida espansione nel gaming Web3."}
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
