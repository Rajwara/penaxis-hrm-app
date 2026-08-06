import datetime as dt
import os

import bcrypt
from jose import jwt, JWTError

SECRET_KEY = os.environ.get("HRM_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# We call the `bcrypt` library directly instead of going through passlib.
# passlib==1.7.4's bcrypt backend does version detection against an internal
# bcrypt attribute that was removed in bcrypt>=4.1.0, which makes it silently
# treat every password as invalid (no crash, verify() just always returns
# False) instead of raising. passlib is in maintenance mode and won't fix
# this, so we avoid it entirely for password hashing.

# bcrypt only uses the first 72 bytes of the input; anything past that is
# ignored. We truncate explicitly so behavior is consistent and predictable
# rather than relying on the library's implicit behavior.
_BCRYPT_MAX_BYTES = 72


def _prep(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prep(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/unexpected hash format in the DB — treat as no match
        # rather than raising a 500 on login.
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = dt.datetime.utcnow() + dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
