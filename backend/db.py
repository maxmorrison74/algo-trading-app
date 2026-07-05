import sqlite3
import os
import json
from datetime import datetime
from cryptography.fernet import Fernet
import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

# Encryption key for API keys
ENCRYPTION_KEY = os.getenv("SAAS_ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # If not set, generate one and save it for development
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "a") as f:
            f.write(f"\nSAAS_ENCRYPTION_KEY={ENCRYPTION_KEY}\n")
    os.environ["SAAS_ENCRYPTION_KEY"] = ENCRYPTION_KEY

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    return cipher_suite.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    try:
        return cipher_suite.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return ""

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'pending',
            subscription_expires_at DATETIME,
            paid_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Migrate existing DBs: add paid_at column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN paid_at DATETIME")
        conn.commit()
    except Exception:
        pass  # Column already exists
    
    # API Keys table (encrypted)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            user_id TEXT PRIMARY KEY,
            alpaca_key TEXT,
            alpaca_secret TEXT,
            binance_key TEXT,
            binance_secret TEXT,
            groq_key TEXT,
            elevenlabs_key TEXT,
            theodds_key TEXT,
            newsapi_key TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Migrate existing api_keys DB: add AI key columns if not exists
    try:
        cursor.execute("ALTER TABLE api_keys ADD COLUMN groq_key TEXT")
        cursor.execute("ALTER TABLE api_keys ADD COLUMN elevenlabs_key TEXT")
        cursor.execute("ALTER TABLE api_keys ADD COLUMN theodds_key TEXT")
        cursor.execute("ALTER TABLE api_keys ADD COLUMN newsapi_key TEXT")
        cursor.execute("ALTER TABLE api_keys ADD COLUMN kraken_key TEXT")
        cursor.execute("ALTER TABLE api_keys ADD COLUMN kraken_secret TEXT")
        conn.commit()
    except Exception:
        pass  # Columns already exist

    # Crypto Payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crypto_payments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            txid TEXT UNIQUE NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# User Operations
def create_user(user_id: str, email: str, password: str, role: str = 'user', status: str = 'pending'):
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        cursor.execute("INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
                       (user_id, email, password_hash, role, status))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def verify_user_login(email: str, password: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, role, status FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    
    if row and bcrypt.checkpw(password.encode('utf-8'), row['password_hash'].encode('utf-8')):
        return dict(row)
    return None

def get_user_by_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, role, status, subscription_expires_at, paid_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, role, status, subscription_expires_at, paid_at, created_at FROM users ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_user_status(user_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
    conn.commit()
    conn.close()

def update_subscription(user_id: str, expires_at: str):
    """Called when a payment is approved. Sets paid_at to now."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE users SET subscription_expires_at = ?, status = 'active', paid_at = ? WHERE id = ?",
        (expires_at, now, user_id)
    )
    conn.commit()
    conn.close()

# API Keys Operations
def save_api_keys(user_id: str, alpaca_key: str = "", alpaca_secret: str = "", binance_key: str = "", binance_secret: str = "", kraken_key: str = "", kraken_secret: str = "", groq_key: str = "", elevenlabs_key: str = "", theodds_key: str = "", newsapi_key: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute("SELECT user_id FROM api_keys WHERE user_id = ?", (user_id,))
    if cursor.fetchone():
        cursor.execute("""
            UPDATE api_keys 
            SET alpaca_key = ?, alpaca_secret = ?, binance_key = ?, binance_secret = ?,
                kraken_key = ?, kraken_secret = ?,
                groq_key = ?, elevenlabs_key = ?, theodds_key = ?, newsapi_key = ?
            WHERE user_id = ?
        """, (
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret),
            encrypt_value(groq_key), encrypt_value(elevenlabs_key),
            encrypt_value(theodds_key), encrypt_value(newsapi_key),
            user_id
        ))
    else:
        cursor.execute("""
            INSERT INTO api_keys (user_id, alpaca_key, alpaca_secret, binance_key, binance_secret, kraken_key, kraken_secret, groq_key, elevenlabs_key, theodds_key, newsapi_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret),
            encrypt_value(groq_key), encrypt_value(elevenlabs_key),
            encrypt_value(theodds_key), encrypt_value(newsapi_key)
        ))
        
    conn.commit()
    conn.close()

def get_api_keys(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM api_keys WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return {
        "alpaca_key": decrypt_value(row['alpaca_key']),
        "alpaca_secret": decrypt_value(row['alpaca_secret']),
        "binance_key": decrypt_value(row['binance_key']),
        "binance_secret": decrypt_value(row['binance_secret']),
        "kraken_key": decrypt_value(row.get('kraken_key', '')),
        "kraken_secret": decrypt_value(row.get('kraken_secret', '')),
        "groq_key": decrypt_value(row.get('groq_key', '')),
        "elevenlabs_key": decrypt_value(row.get('elevenlabs_key', '')),
        "theodds_key": decrypt_value(row.get('theodds_key', '')),
        "newsapi_key": decrypt_value(row.get('newsapi_key', ''))
    }

# Crypto Payments Operations
def create_payment(payment_id: str, user_id: str, txid: str, amount: float, currency: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO crypto_payments (id, user_id, txid, amount, currency)
            VALUES (?, ?, ?, ?, ?)
        """, (payment_id, user_id, txid, amount, currency))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def update_payment_status(payment_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE crypto_payments SET status = ? WHERE id = ?", (status, payment_id))
    conn.commit()
    conn.close()

def get_all_payments():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, u.email as user_email 
        FROM crypto_payments p 
        JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Initialize DB on import
init_db()
