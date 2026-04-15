from datetime import datetime, timedelta
from jose import jwt, JWTError

from config import settings

ALGORITHM = "HS256"


def create_token(license_key: str, device_fingerprint: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    payload = {
        "sub": license_key,
        "device": device_fingerprint,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
