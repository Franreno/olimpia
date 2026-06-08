from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import Settings, get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(password, hashed_password)


def _create_token(subject: str, token_type: str, expires_delta: timedelta, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, settings: Settings | None = None, expires_delta: timedelta | None = None) -> str:
    settings = settings or get_settings()
    delta = expires_delta if expires_delta is not None else timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(subject, "access", delta, settings)


def create_refresh_token(subject: str, settings: Settings | None = None, expires_delta: timedelta | None = None) -> str:
    settings = settings or get_settings()
    delta = expires_delta if expires_delta is not None else timedelta(days=settings.refresh_token_expire_days)
    return _create_token(subject, "refresh", delta, settings)


def decode_token(token: str, settings: Settings | None = None) -> dict | None:
    settings = settings or get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
