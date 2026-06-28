import requests
import concurrent.futures
import time

URL_STATUS = "http://localhost:8000/api/status"
URL_TEST_CONN = "http://localhost:8000/api/test-connection"
URL_LOGS = "http://localhost:8000/api/logs"

def test_read_status():
    try:
        res = requests.get(URL_STATUS, timeout=5)
        return res.status_code
    except Exception as e:
        return str(e)

def test_alpaca_connection():
    try:
        payload = {"service": "alpaca"}
        res = requests.post(URL_TEST_CONN, json=payload, timeout=10)
        return res.status_code
    except Exception as e:
        return str(e)

def test_binance_connection():
    try:
        payload = {"service": "binance"}
        res = requests.post(URL_TEST_CONN, json=payload, timeout=10)
        return res.status_code
    except Exception as e:
        return str(e)

def run_stress_test():
    print("🚀 Iniziando Stress Test dell'architettura...")
    
    # 1. 100 Letture di Status Concorrenti
    print("\\n[1] Eseguendo 100 richieste concorrenti su /api/status (Lettura DB)...")
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = list(executor.map(lambda _: test_read_status(), range(100)))
    
    success_status = results.count(200)
    print(f"✅ {success_status}/100 completate con successo. Errori: {100-success_status}")
    print(f"⏱ Tempo impiegato: {time.time() - start_time:.2f}s")

    # 2. 50 Test Connessioni Alpaca Concorrenti (Stress Limit API Reali)
    print("\\n[2] Eseguendo 50 richieste concorrenti su Alpaca API (Rischio Rate Limit)...")
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        results_alpaca = list(executor.map(lambda _: test_alpaca_connection(), range(50)))
    
    success_alpaca = results_alpaca.count(200)
    errors_429 = results_alpaca.count(429)
    print(f"✅ {success_alpaca}/50 completate (Status 200).")
    print(f"⚠️ {errors_429} Rate Limits (Status 429). Altri Errori: {50 - success_alpaca - errors_429}")
    print(f"⏱ Tempo impiegato: {time.time() - start_time:.2f}s")
    
    # 3. 50 Test Connessioni Binance Concorrenti
    print("\\n[3] Eseguendo 50 richieste concorrenti su Binance API (Rischio Rate Limit)...")
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        results_binance = list(executor.map(lambda _: test_binance_connection(), range(50)))
    
    success_binance = results_binance.count(200)
    errors_429_binance = results_binance.count(429)
    print(f"✅ {success_binance}/50 completate (Status 200).")
    print(f"⚠️ {errors_429_binance} Rate Limits (Status 429). Altri Errori: {50 - success_binance - errors_429_binance}")
    print(f"⏱ Tempo impiegato: {time.time() - start_time:.2f}s")

    print("\\n🎉 Stress test completato!")

if __name__ == "__main__":
    run_stress_test()
