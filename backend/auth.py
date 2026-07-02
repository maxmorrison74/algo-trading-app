import hashlib
import hmac
import os
import secrets
import time

from fastapi import Header, HTTPException, status


SESSION_TTL_SECONDS = int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "86400"))
_active_sessions = {}


def is_admin_configured() -> bool:
    return bool(os.getenv("ADMIN_PASSWORD_HASH"))


def verify_admin_password(password: str) -> bool:
    admin_hash = os.getenv("ADMIN_PASSWORD_HASH")
    if not admin_hash:
        return False
    provided_hash = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(provided_hash, admin_hash)


def create_admin_session() -> str:
    token = secrets.token_urlsafe(32)
    _active_sessions[token] = time.time() + SESSION_TTL_SECONDS
    return token


def revoke_admin_session(token: str) -> None:
    _active_sessions.pop(token, None)


def _prune_sessions() -> None:
    now = time.time()
    expired = [token for token, expires_at in _active_sessions.items() if expires_at <= now]
    for token in expired:
        _active_sessions.pop(token, None)


def require_admin(authorization: str | None = Header(default=None)) -> str:
    if not is_admin_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_PASSWORD_HASH non configurato sul server",
        )

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticazione richiesta",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Bearer non valido",
        )

    _prune_sessions()
    expires_at = _active_sessions.get(token)
    if not expires_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessione scaduta o non valida",
        )

    _active_sessions[token] = time.time() + SESSION_TTL_SECONDS
    return token
