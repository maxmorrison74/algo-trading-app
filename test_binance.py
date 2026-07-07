import asyncio
import ccxt.async_support as ccxt
async def main():
    b = ccxt.binance()
    try:
        t = await b.fetch_tickers()
        print(f"Total tickers: {len(t)}")
        usdt_tickers = [k for k in t.keys() if k.endswith('/USDT')]
        print(f"USDT tickers: {len(usdt_tickers)}")
        print("Sample:", usdt_tickers[:5])
    except Exception as e:
        print("Error:", e)
    await b.close()
asyncio.run(main())
