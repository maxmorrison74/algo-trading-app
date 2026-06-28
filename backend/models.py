from sqlalchemy import Boolean, Column, Integer, String, Float
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    stripe_customer_id = Column(String, nullable=True)
    subscription_active = Column(Boolean, default=False)
    
    # API Keys - in un app vera andrebbero criptati con KMS
    binance_key = Column(String, nullable=True)
    binance_secret = Column(String, nullable=True)
    kraken_key = Column(String, nullable=True)
    kraken_secret = Column(String, nullable=True)
    alpaca_key = Column(String, nullable=True)
    alpaca_secret = Column(String, nullable=True)
    
    # Virtual Cash (per i conti di simulazione o fallback)
    virtual_cash = Column(Float, default=100000.0)
