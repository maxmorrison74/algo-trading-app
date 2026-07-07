import asyncio
import ccxt.async_support as ccxt
async def main():
    b = ccxt.binance()
    m = await b.load_markets()
    print("Markets loaded!")
    await b.close()
asyncio.run(main())
