import sqlite3
import os
import json
from datetime import datetime
from cryptography.fernet import Fernet
import bcrypt
from dotenv import load_dotenv

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")
ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

# Load backend .env before resolving encryption settings,
# otherwise a restart can generate a different key and make
# previously stored secrets unreadable.
load_dotenv(dotenv_path=ENV_PATH)

# Encryption key for API keys
ENCRYPTION_KEY = os.getenv("SAAS_ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # If not set, generate one and save it for development
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "a") as f:
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
            email_verified_at DATETIME,
            email_confirmation_token TEXT,
            email_confirmation_sent_at DATETIME,
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
    for migration in (
        "ALTER TABLE users ADD COLUMN email_verified_at DATETIME",
        "ALTER TABLE users ADD COLUMN email_confirmation_token TEXT",
        "ALTER TABLE users ADD COLUMN email_confirmation_sent_at DATETIME",
    ):
        try:
            cursor.execute(migration)
            conn.commit()
        except Exception:
            pass
    
    # API Keys table (encrypted)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            user_id TEXT PRIMARY KEY,
            alpaca_key TEXT,
            alpaca_secret TEXT,
            binance_key TEXT,
            binance_secret TEXT,
            groq_key TEXT,
            gemini_key TEXT,
            elevenlabs_key TEXT,
            theodds_key TEXT,
            newsapi_key TEXT,
            telegram_bot_token TEXT,
            telegram_chat_id TEXT,
            pushover_app_token TEXT,
            pushover_user_key TEXT,
            oanda_key TEXT,
            oanda_account TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Migrate existing api_keys DB: ogni colonna ha il suo try/except separato
    # così se una esiste già le altre vengono comunque aggiunte
    _migrations = [
        "ALTER TABLE api_keys ADD COLUMN groq_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN gemini_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN elevenlabs_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN theodds_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN newsapi_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN telegram_bot_token TEXT",
        "ALTER TABLE api_keys ADD COLUMN telegram_chat_id TEXT",
        "ALTER TABLE api_keys ADD COLUMN pushover_app_token TEXT",
        "ALTER TABLE api_keys ADD COLUMN pushover_user_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN kraken_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN kraken_secret TEXT",
        "ALTER TABLE api_keys ADD COLUMN oanda_key TEXT",
        "ALTER TABLE api_keys ADD COLUMN oanda_account TEXT",
    ]
    for _sql in _migrations:
        try:
            cursor.execute(_sql)
            conn.commit()
        except Exception:
            pass  # Colonna già esistente, ok

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
    cursor.execute(
        "SELECT id, email, password_hash, role, status, email_verified_at FROM users WHERE email = ?",
        (email,),
    )
    row = cursor.fetchone()
    conn.close()
    
    if row and bcrypt.checkpw(password.encode('utf-8'), row['password_hash'].encode('utf-8')):
        return dict(row)
    return None

def get_user_by_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, role, status, email_verified_at, subscription_expires_at, paid_at FROM users WHERE id = ?",
        (user_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, email, role, status, email_verified_at, email_confirmation_token,
               email_confirmation_sent_at, subscription_expires_at, paid_at
        FROM users
        WHERE email = ?
        """,
        (email,),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, role, status, email_verified_at, subscription_expires_at, paid_at, created_at FROM users ORDER BY created_at DESC"
    )
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

def set_email_confirmation_token(user_id: str, token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE users SET email_confirmation_token = ?, email_confirmation_sent_at = ? WHERE id = ?",
        (token, now, user_id),
    )
    conn.commit()
    conn.close()

def mark_user_email_verified(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        UPDATE users
        SET email_verified_at = ?, email_confirmation_token = NULL
        WHERE id = ?
        """,
        (now, user_id),
    )
    conn.commit()
    conn.close()

def confirm_user_email(token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, email, role, status, email_verified_at, subscription_expires_at, paid_at
        FROM users
        WHERE email_confirmation_token = ?
        """,
        (token,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        UPDATE users
        SET email_verified_at = ?, email_confirmation_token = NULL
        WHERE id = ?
        """,
        (now, row["id"]),
    )
    conn.commit()
    cursor.execute(
        "SELECT id, email, role, status, email_verified_at, subscription_expires_at, paid_at FROM users WHERE id = ?",
        (row["id"],),
    )
    updated = cursor.fetchone()
    conn.close()
    return dict(updated) if updated else None

def delete_user(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

# API Keys Operations
def save_api_keys(user_id: str, alpaca_key: str = "", alpaca_secret: str = "", binance_key: str = "", binance_secret: str = "", kraken_key: str = "", kraken_secret: str = "", groq_key: str = "", gemini_key: str = "", elevenlabs_key: str = "", theodds_key: str = "", newsapi_key: str = "", telegram_bot_token: str = "", telegram_chat_id: str = "", pushover_app_token: str = "", pushover_user_key: str = "", oanda_key: str = "", oanda_account: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id FROM api_keys WHERE user_id = ?", (user_id,))
    if cursor.fetchone():
        cursor.execute("""
            UPDATE api_keys 
            SET alpaca_key = ?, alpaca_secret = ?, binance_key = ?, binance_secret = ?,
                kraken_key = ?, kraken_secret = ?,
                groq_key = ?, gemini_key = ?, elevenlabs_key = ?, theodds_key = ?, newsapi_key = ?,
                telegram_bot_token = ?, telegram_chat_id = ?, pushover_app_token = ?, pushover_user_key = ?,
                oanda_key = ?, oanda_account = ?
            WHERE user_id = ?
        """, (
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret),
            encrypt_value(groq_key), encrypt_value(gemini_key), encrypt_value(elevenlabs_key),
            encrypt_value(theodds_key), encrypt_value(newsapi_key),
            encrypt_value(telegram_bot_token), encrypt_value(telegram_chat_id),
            encrypt_value(pushover_app_token), encrypt_value(pushover_user_key),
            encrypt_value(oanda_key), encrypt_value(oanda_account),
            user_id
        ))
    else:
        cursor.execute("""
            INSERT INTO api_keys (user_id, alpaca_key, alpaca_secret, binance_key, binance_secret, kraken_key, kraken_secret, groq_key, gemini_key, elevenlabs_key, theodds_key, newsapi_key, telegram_bot_token, telegram_chat_id, pushover_app_token, pushover_user_key, oanda_key, oanda_account)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            encrypt_value(alpaca_key), encrypt_value(alpaca_secret),
            encrypt_value(binance_key), encrypt_value(binance_secret),
            encrypt_value(kraken_key), encrypt_value(kraken_secret),
            encrypt_value(groq_key), encrypt_value(gemini_key), encrypt_value(elevenlabs_key),
            encrypt_value(theodds_key), encrypt_value(newsapi_key),
            encrypt_value(telegram_bot_token), encrypt_value(telegram_chat_id),
            encrypt_value(pushover_app_token), encrypt_value(pushover_user_key),
            encrypt_value(oanda_key), encrypt_value(oanda_account)
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
    
    # Converti sqlite3.Row in dict per usare .get() con default
    row = dict(row)
    
    return {
        "alpaca_key": decrypt_value(row.get('alpaca_key', '')),
        "alpaca_secret": decrypt_value(row.get('alpaca_secret', '')),
        "binance_key": decrypt_value(row.get('binance_key', '')),
        "binance_secret": decrypt_value(row.get('binance_secret', '')),
        "kraken_key": decrypt_value(row.get('kraken_key', '')),
        "kraken_secret": decrypt_value(row.get('kraken_secret', '')),
        "groq_key": decrypt_value(row.get('groq_key', '')),
        "elevenlabs_key": decrypt_value(row.get('elevenlabs_key', '')),
        "theodds_key": decrypt_value(row.get('theodds_key', '')),
        "newsapi_key": decrypt_value(row.get('newsapi_key', '')),
        "telegram_bot_token": decrypt_value(row.get('telegram_bot_token', '')),
        "telegram_chat_id": decrypt_value(row.get('telegram_chat_id', '')),
        "pushover_app_token": decrypt_value(row.get('pushover_app_token', '')),
        "pushover_user_key": decrypt_value(row.get('pushover_user_key', '')),
        "oanda_key": decrypt_value(row.get('oanda_key', '')),
        "oanda_account": decrypt_value(row.get('oanda_account', ''))
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
