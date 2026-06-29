import sys
sys.path.append('backend')
from api import BotState
from alpaca_trading import AlpacaEngine

bot_state = BotState()
bot_state.modules['trading'] = True
engine = AlpacaEngine(bot_state)
engine.loop()
