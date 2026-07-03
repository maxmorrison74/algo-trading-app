import base64
import hashlib
import hmac
import json
import os
import secrets
import shutil
import struct
import subprocess
import tempfile
import time
from typing import Optional

from fastapi import Header, HTTPException, Request, status


SESSION_TTL_SECONDS = int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "86400"))
MAX_LOGIN_ATTEMPTS = int(os.getenv("ADMIN_LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_WINDOW_SECONDS = int(os.getenv("ADMIN_LOGIN_WINDOW_SECONDS", "900"))
PASSKEY_CHALLENGE_TTL_SECONDS = int(os.getenv("PASSKEY_CHALLENGE_TTL_SECONDS", "300"))
PASSKEY_DB_FILE = os.path.join(os.path.dirname(__file__), "passkeys_db.json")

_active_sessions = {}
_login_attempts = {}
_pending_passkey_requests = {}


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


def _prune_login_attempts() -> None:
    now = time.time()
    expired = [key for key, attempt_times in _login_attempts.items() if not [ts for ts in attempt_times if now - ts < LOGIN_WINDOW_SECONDS]]
    for key in expired:
        _login_attempts.pop(key, None)


def assert_login_allowed(client_id: str) -> None:
    _prune_login_attempts()
    attempt_times = [ts for ts in _login_attempts.get(client_id, []) if time.time() - ts < LOGIN_WINDOW_SECONDS]
    _login_attempts[client_id] = attempt_times
    if len(attempt_times) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Troppi tentativi di login. Riprova più tardi",
        )


def record_login_failure(client_id: str) -> None:
    now = time.time()
    attempt_times = [ts for ts in _login_attempts.get(client_id, []) if now - ts < LOGIN_WINDOW_SECONDS]
    attempt_times.append(now)
    _login_attempts[client_id] = attempt_times


def clear_login_failures(client_id: str) -> None:
    _login_attempts.pop(client_id, None)


def require_admin(authorization: Optional[str] = Header(default=None)) -> str:
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

import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(32)
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "a") as f:
            f.write(f"\nJWT_SECRET={JWT_SECRET}\n")
    os.environ["JWT_SECRET"] = JWT_SECRET

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

def create_user_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def require_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticazione richiesta",
        )
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformato",
        )
        
    try:
        # Check if it's the admin master token
        if token in _active_sessions:
            _prune_sessions()
            if _active_sessions.get(token):
                _active_sessions[token] = time.time() + SESSION_TTL_SECONDS
                return {"sub": "admin", "role": "admin"}
                
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessione scaduta. Fai di nuovo login",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido",
        )

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _load_passkey_db() -> dict:
    if os.path.exists(PASSKEY_DB_FILE):
        try:
            with open(PASSKEY_DB_FILE, "r") as handle:
                data = json.load(handle)
                if isinstance(data, dict) and isinstance(data.get("credentials"), list):
                    return data
        except json.JSONDecodeError:
            pass
    return {"credentials": [], "updated_at": None}


def _save_passkey_db(data: dict) -> None:
    data["updated_at"] = int(time.time())
    with open(PASSKEY_DB_FILE, "w") as handle:
        json.dump(data, handle)


def _prune_passkey_requests() -> None:
    now = time.time()
    expired = [request_id for request_id, payload in _pending_passkey_requests.items() if payload.get("expires_at", 0) <= now]
    for request_id in expired:
        _pending_passkey_requests.pop(request_id, None)


def _request_rp_id(request: Request) -> str:
    configured = os.getenv("PASSKEY_RP_ID")
    if configured:
        return configured.strip()
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc or request.url.hostname or ""
    host = host.split(",")[0].strip()
    return host.split(":")[0]


def _request_origin(request: Request) -> str:
    configured = os.getenv("PASSKEY_ORIGIN")
    if configured:
        return configured.strip()
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc or ""
    host = host.split(",")[0].strip()
    return f"{scheme}://{host}"


def _admin_user_id() -> bytes:
    return hashlib.sha256(b"aureo-admin").digest()[:16]


def _openssl_available() -> bool:
    return shutil.which("openssl") is not None


class _CborReader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def _read(self, length: int) -> bytes:
        if self.pos + length > len(self.data):
            raise ValueError("CBOR troncato")
        chunk = self.data[self.pos:self.pos + length]
        self.pos += length
        return chunk

    def _read_length(self, additional: int) -> int:
        if additional < 24:
            return additional
        if additional == 24:
            return self._read(1)[0]
        if additional == 25:
            return struct.unpack(">H", self._read(2))[0]
        if additional == 26:
            return struct.unpack(">I", self._read(4))[0]
        if additional == 27:
            return struct.unpack(">Q", self._read(8))[0]
        raise ValueError("CBOR con lunghezza non supportata")

    def decode(self):
        initial = self._read(1)[0]
        major = initial >> 5
        additional = initial & 0x1F

        if major in {0, 1, 2, 3, 4, 5, 6}:
            length = self._read_length(additional)

        if major == 0:
            return length
        if major == 1:
            return -1 - length
        if major == 2:
            return self._read(length)
        if major == 3:
            return self._read(length).decode("utf-8")
        if major == 4:
            return [self.decode() for _ in range(length)]
        if major == 5:
            return {self.decode(): self.decode() for _ in range(length)}
        if major == 6:
            return self.decode()
        if major == 7:
            if additional == 20:
                return False
            if additional == 21:
                return True
            if additional == 22:
                return None
        raise ValueError("Tipo CBOR non supportato")


def _cbor_decode(payload: bytes):
    return _CborReader(payload).decode()


def _extract_cbor_slice(payload: bytes) -> tuple[object, bytes]:
    reader = _CborReader(payload)
    value = reader.decode()
    return value, payload[:reader.pos]


def _parse_authenticator_data(raw: bytes) -> dict:
    if len(raw) < 37:
        raise HTTPException(status_code=400, detail="Authenticator data non valida")

    result = {
        "rp_id_hash": raw[:32],
        "flags": raw[32],
        "sign_count": struct.unpack(">I", raw[33:37])[0],
    }
    offset = 37

    if result["flags"] & 0x40:
        if len(raw) < offset + 18:
            raise HTTPException(status_code=400, detail="Attested credential data incompleta")
        result["aaguid"] = raw[offset:offset + 16]
        offset += 16
        credential_id_length = struct.unpack(">H", raw[offset:offset + 2])[0]
        offset += 2
        result["credential_id"] = raw[offset:offset + credential_id_length]
        offset += credential_id_length
        _, credential_public_key_slice = _extract_cbor_slice(raw[offset:])
        result["credential_public_key"] = credential_public_key_slice

    return result


def _credential_pem_from_cose(cose_key: bytes) -> str:
    parsed = _cbor_decode(cose_key)
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="Chiave pubblica WebAuthn non valida")

    x = parsed.get(-2)
    y = parsed.get(-3)
    kty = parsed.get(1)
    alg = parsed.get(3)
    curve = parsed.get(-1)
    if kty != 2 or alg != -7 or curve != 1 or not isinstance(x, bytes) or not isinstance(y, bytes):
        raise HTTPException(status_code=400, detail="Solo passkeys ES256 sono supportate")

    uncompressed = b"\x04" + x + y
    der_prefix = bytes.fromhex("3059301306072A8648CE3D020106082A8648CE3D030107034200")
    der = der_prefix + uncompressed
    body = base64.encodebytes(der).decode("ascii").replace("\n", "")
    wrapped = "\n".join(body[i:i + 64] for i in range(0, len(body), 64))
    return f"-----BEGIN PUBLIC KEY-----\n{wrapped}\n-----END PUBLIC KEY-----\n"


def _verify_client_data(client_data_json: bytes, expected_challenge: str, expected_origin: str, expected_type: str) -> None:
    try:
        parsed = json.loads(client_data_json.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="clientDataJSON non valido")

    if parsed.get("type") != expected_type:
        raise HTTPException(status_code=400, detail="Tipo WebAuthn non valido")
    if parsed.get("challenge") != expected_challenge:
        raise HTTPException(status_code=400, detail="Challenge WebAuthn non valida")
    if parsed.get("origin") != expected_origin:
        raise HTTPException(status_code=400, detail="Origin WebAuthn non valida")


def _verify_rp_id_hash(rp_id: str, rp_id_hash: bytes) -> None:
    expected = hashlib.sha256(rp_id.encode("utf-8")).digest()
    if not hmac.compare_digest(expected, rp_id_hash):
        raise HTTPException(status_code=400, detail="RP ID non valida per la passkey")


def _verify_passkey_signature(public_key_pem: str, authenticator_data: bytes, client_data_json: bytes, signature: bytes) -> None:
    if not _openssl_available():
        raise HTTPException(
            status_code=503,
            detail="OpenSSL non disponibile sul server per validare la passkey",
        )

    signed_payload = authenticator_data + hashlib.sha256(client_data_json).digest()
    with tempfile.TemporaryDirectory() as temp_dir:
        pubkey_path = os.path.join(temp_dir, "pubkey.pem")
        payload_path = os.path.join(temp_dir, "payload.bin")
        signature_path = os.path.join(temp_dir, "signature.bin")

        with open(pubkey_path, "w") as handle:
            handle.write(public_key_pem)
        with open(payload_path, "wb") as handle:
            handle.write(signed_payload)
        with open(signature_path, "wb") as handle:
            handle.write(signature)

        result = subprocess.run(
            ["openssl", "dgst", "-sha256", "-verify", pubkey_path, "-signature", signature_path, payload_path],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=401, detail="Firma biometrica non valida")


def get_passkey_status() -> dict:
    db = _load_passkey_db()
    return {
        "supported": _openssl_available(),
        "configured": len(db["credentials"]) > 0,
        "credentials_count": len(db["credentials"]),
        "credentials": [
            {
                "id": credential["id"],
                "label": credential.get("label") or "Questo dispositivo",
                "added_at": credential.get("added_at"),
                "last_used_at": credential.get("last_used_at"),
            }
            for credential in db["credentials"]
        ],
    }


def begin_passkey_registration(request: Request, admin_token: str) -> dict:
    _prune_passkey_requests()
    db = _load_passkey_db()
    rp_id = _request_rp_id(request)
    origin = _request_origin(request)
    challenge = _b64url_encode(secrets.token_bytes(32))
    request_id = secrets.token_urlsafe(18)
    _pending_passkey_requests[request_id] = {
        "type": "register",
        "challenge": challenge,
        "origin": origin,
        "rp_id": rp_id,
        "token": admin_token,
        "expires_at": time.time() + PASSKEY_CHALLENGE_TTL_SECONDS,
    }
    return {
        "request_id": request_id,
        "publicKey": {
            "rp": {"name": "Aureo OS", "id": rp_id},
            "user": {
                "id": _b64url_encode(_admin_user_id()),
                "name": "admin@aureo.local",
                "displayName": "Aureo Admin",
            },
            "challenge": challenge,
            "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
            "timeout": 60000,
            "attestation": "none",
            "authenticatorSelection": {
                "residentKey": "preferred",
                "userVerification": "preferred",
            },
            "excludeCredentials": [
                {"type": "public-key", "id": credential["id"]}
                for credential in db["credentials"]
            ],
        },
    }


def finish_passkey_registration(payload: dict, admin_token: str) -> dict:
    _prune_passkey_requests()
    request_id = payload.get("request_id", "")
    pending = _pending_passkey_requests.get(request_id)
    if not pending or pending.get("type") != "register":
        raise HTTPException(status_code=400, detail="Registrazione biometrica scaduta o non valida")
    if pending.get("token") != admin_token:
        raise HTTPException(status_code=401, detail="Sessione non valida per registrare la passkey")

    response = payload.get("response") or {}
    client_data_json = _b64url_decode(response.get("client_data_json", ""))
    attestation_object = _b64url_decode(response.get("attestation_object", ""))
    _verify_client_data(client_data_json, pending["challenge"], pending["origin"], "webauthn.create")

    attestation = _cbor_decode(attestation_object)
    auth_data_raw = attestation.get("authData") if isinstance(attestation, dict) else None
    if not isinstance(auth_data_raw, bytes):
        raise HTTPException(status_code=400, detail="Attestation object non valido")

    auth_data = _parse_authenticator_data(auth_data_raw)
    _verify_rp_id_hash(pending["rp_id"], auth_data["rp_id_hash"])
    if not auth_data["flags"] & 0x01:
        raise HTTPException(status_code=400, detail="Presenza utente non confermata")

    credential_id = _b64url_encode(auth_data.get("credential_id", b""))
    raw_id = payload.get("raw_id", "")
    if not credential_id or credential_id != raw_id:
        raise HTTPException(status_code=400, detail="Credential ID non valida")

    public_key_pem = _credential_pem_from_cose(auth_data["credential_public_key"])
    db = _load_passkey_db()
    label = (payload.get("label") or "").strip() or "Questo dispositivo"
    now = datetime_string()
    record = {
        "id": credential_id,
        "public_key_pem": public_key_pem,
        "sign_count": auth_data.get("sign_count", 0),
        "added_at": now,
        "last_used_at": None,
        "label": label,
    }
    db["credentials"] = [item for item in db["credentials"] if item.get("id") != credential_id]
    db["credentials"].append(record)
    _save_passkey_db(db)
    _pending_passkey_requests.pop(request_id, None)
    return {
        "status": "success",
        "credential": {k: v for k, v in record.items() if k != "public_key_pem"},
        "credentials_count": len(db["credentials"]),
    }


def begin_passkey_authentication(request: Request) -> dict:
    _prune_passkey_requests()
    db = _load_passkey_db()
    if not db["credentials"]:
        raise HTTPException(status_code=404, detail="Nessun dispositivo biometrico registrato")

    challenge = _b64url_encode(secrets.token_bytes(32))
    request_id = secrets.token_urlsafe(18)
    _pending_passkey_requests[request_id] = {
        "type": "auth",
        "challenge": challenge,
        "origin": _request_origin(request),
        "rp_id": _request_rp_id(request),
        "expires_at": time.time() + PASSKEY_CHALLENGE_TTL_SECONDS,
    }
    return {
        "request_id": request_id,
        "publicKey": {
            "challenge": challenge,
            "rpId": _pending_passkey_requests[request_id]["rp_id"],
            "timeout": 60000,
            "userVerification": "preferred",
            "allowCredentials": [
                {"type": "public-key", "id": credential["id"]}
                for credential in db["credentials"]
            ],
        },
    }


def finish_passkey_authentication(payload: dict, request: Request) -> dict:
    _prune_passkey_requests()
    request_id = payload.get("request_id", "")
    pending = _pending_passkey_requests.get(request_id)
    if not pending or pending.get("type") != "auth":
        raise HTTPException(status_code=400, detail="Richiesta biometrica scaduta o non valida")

    response = payload.get("response") or {}
    client_data_json = _b64url_decode(response.get("client_data_json", ""))
    authenticator_data = _b64url_decode(response.get("authenticator_data", ""))
    signature = _b64url_decode(response.get("signature", ""))
    _verify_client_data(client_data_json, pending["challenge"], pending["origin"], "webauthn.get")

    parsed_auth_data = _parse_authenticator_data(authenticator_data)
    _verify_rp_id_hash(pending["rp_id"], parsed_auth_data["rp_id_hash"])
    if not parsed_auth_data["flags"] & 0x01:
        raise HTTPException(status_code=400, detail="Presenza utente non confermata")

    credential_id = payload.get("raw_id", "")
    db = _load_passkey_db()
    credential = next((item for item in db["credentials"] if item.get("id") == credential_id), None)
    if not credential:
        raise HTTPException(status_code=401, detail="Passkey non riconosciuta")

    _verify_passkey_signature(credential["public_key_pem"], authenticator_data, client_data_json, signature)

    old_counter = int(credential.get("sign_count") or 0)
    new_counter = int(parsed_auth_data.get("sign_count") or 0)
    if old_counter and new_counter and new_counter <= old_counter:
        raise HTTPException(status_code=401, detail="Contatore passkey non valido")

    credential["sign_count"] = max(old_counter, new_counter)
    credential["last_used_at"] = datetime_string()
    _save_passkey_db(db)
    _pending_passkey_requests.pop(request_id, None)

    client_id = request.client.host if request.client else "unknown"
    clear_login_failures(client_id)
    token = create_admin_session()
    return {"status": "success", "token": token, "expires_in": SESSION_TTL_SECONDS}


def datetime_string() -> str:
    return time.strftime("%Y-%m-%d %H:%M", time.localtime())
