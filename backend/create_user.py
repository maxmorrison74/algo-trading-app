import argparse
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta

import bcrypt
import db


def main():
    parser = argparse.ArgumentParser(description="Crea o aggiorna un utente Aureo OS.")
    parser.add_argument("--email", required=True, help="Email utente")
    parser.add_argument("--password", required=True, help="Password utente")
    parser.add_argument("--role", default="user", choices=["user", "admin"], help="Ruolo utente")
    parser.add_argument("--status", default="active", choices=["pending", "active", "demo"], help="Stato utente")
    parser.add_argument("--months", type=int, default=1, help="Mesi di abbonamento da attivare")
    parser.add_argument("--update-existing", action="store_true", help="Aggiorna un utente già esistente")
    args = parser.parse_args()

    db.init_db()

    conn = db.get_db_connection()
    conn.row_factory = sqlite3.Row
    existing = conn.execute(
        "SELECT id, email, role, status, subscription_expires_at FROM users WHERE lower(email)=lower(?)",
        (args.email,),
    ).fetchone()
    conn.close()

    months = max(1, min(int(args.months or 1), 24))
    expires_at = (datetime.utcnow() + timedelta(days=30 * months)).strftime("%Y-%m-%d %H:%M:%S")
    paid_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    if existing and not args.update_existing:
      print(f"Utente già esistente: {existing['email']} ({existing['status']})")
      print("Usa --update-existing per aggiornarlo.")
      return 1

    if existing and args.update_existing:
        conn = db.get_db_connection()
        password_hash = bcrypt.hashpw(args.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        conn.execute(
            "UPDATE users SET email = ?, password_hash = ?, role = ?, status = ?, subscription_expires_at = ?, paid_at = ? WHERE id = ?",
            (args.email, password_hash, args.role, args.status, expires_at, paid_at, existing["id"]),
        )
        conn.commit()
        conn.close()
        print(f"Utente aggiornato: {args.email}")
        print(f"Ruolo: {args.role}")
        print(f"Stato: {args.status}")
        print(f"Scadenza: {expires_at}")
        return 0

    user_id = str(uuid.uuid4())
    ok = db.create_user(user_id, args.email, args.password, role=args.role, status=args.status)
    if not ok:
        print("Creazione fallita.")
        return 1

    conn = db.get_db_connection()
    conn.execute(
        "UPDATE users SET subscription_expires_at = ?, paid_at = ? WHERE id = ?",
        (expires_at, paid_at, user_id),
    )
    conn.commit()
    conn.close()

    print(f"Utente creato: {args.email}")
    print(f"Ruolo: {args.role}")
    print(f"Stato: {args.status}")
    print(f"Scadenza: {expires_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
