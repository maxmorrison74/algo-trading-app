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
            plan_id TEXT DEFAULT 'pro',
            subscription_expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute("PRAGMA table_info(users)")
    user_columns = {row[1] for row in cursor.fetchall()}
    if "plan_id" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN plan_id TEXT DEFAULT 'pro'")
    
    # API Keys table (encrypted)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            user_id TEXT PRIMARY KEY,
            alpaca_key TEXT,
            alpaca_secret TEXT,
            binance_key TEXT,
            binance_secret TEXT,
            kraken_key TEXT,
            kraken_secret TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute("PRAGMA table_info(api_keys)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "kraken_key" not in existing_columns:
        cursor.execute("ALTER TABLE api_keys ADD COLUMN kraken_key TEXT")
    if "kraken_secret" not in existing_columns:
        cursor.execute("ALTER TABLE api_keys ADD COLUMN kraken_secret TEXT")
    
    # Crypto Payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crypto_payments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            txid TEXT UNIQUE NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            check_status TEXT DEFAULT 'unchecked',
            check_message TEXT,
            checked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute("PRAGMA table_info(crypto_payments)")
    payment_columns = {row[1] for row in cursor.fetchall()}
    if "check_status" not in payment_columns:
        cursor.execute("ALTER TABLE crypto_payments ADD COLUMN check_status TEXT DEFAULT 'unchecked'")
    if "check_message" not in payment_columns:
        cursor.execute("ALTER TABLE crypto_payments ADD COLUMN check_message TEXT")
    if "checked_at" not in payment_columns:
        cursor.execute("ALTER TABLE crypto_payments ADD COLUMN checked_at DATETIME")
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# User Operations
def create_user(user_id: str, email: str, password: str, role: str = 'user', status: str = 'pending', plan_id: str = 'pro'):
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        cursor.execute("INSERT INTO users (id, email, password_hash, role, status, plan_id) VALUES (?, ?, ?, ?, ?, ?)",
                       (user_id, email, password_hash, role, status, plan_id))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def verify_user_login(email: str, password: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, role, status, plan_id FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    
    if row and bcrypt.checkpw(password.encode('utf-8'), row['password_hash'].encode('utf-8')):
        return dict(row)
    return None

def get_user_by_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, role, status, plan_id, subscription_expires_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, role, status, plan_id, subscription_expires_at, created_at FROM users ORDER BY created_at DESC")
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
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET subscription_expires_at = ?, status = 'active' WHERE id = ?", (expires_at, user_id))
    conn.commit()
    conn.close()

def update_user_plan(user_id: str, plan_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET plan_id = ? WHERE id = ?", (plan_id, user_id))
    conn.commit()
    conn.close()

# API Keys Operations
def save_api_keys(
    user_id: str,
    alpaca_key: str = "",
    alpaca_secret: str = "",
    binance_key: str = "",
    binance_secret: str = "",
    kraken_key: str = "",
    kraken_secret: str = "",
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute("SELECT user_id FROM api_keys WHERE user_id = ?", (user_id,))
    if cursor.fetchone():
        cursor.execute("""
            UPDATE api_keys 
            SET alpaca_key = ?, alpaca_secret = ?, binance_key = ?, binance_secret = ?, kraken_key = ?, kraken_secret = ?
            WHERE user_id = ?
        """, (
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret),
            user_id
        ))
    else:
        cursor.execute("""
            INSERT INTO api_keys (user_id, alpaca_key, alpaca_secret, binance_key, binance_secret, kraken_key, kraken_secret)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret)
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
        "kraken_key": decrypt_value(row['kraken_key']),
        "kraken_secret": decrypt_value(row['kraken_secret']),
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

def update_payment_check(payment_id: str, check_status: str, check_message: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE crypto_payments SET check_status = ?, check_message = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?",
        (check_status, check_message, payment_id)
    )
    conn.commit()
    conn.close()

def get_payment_by_id(payment_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, u.email as user_email
        FROM crypto_payments p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    """, (payment_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

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
