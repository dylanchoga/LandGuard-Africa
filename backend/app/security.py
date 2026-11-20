import os
import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)

# Demo uses PBKDF2-HMAC-SHA256 from Python's standard library.
# A production deployment should use an audited identity provider and Argon2id/MFA.
def hash_password(password: str):
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 500_000)
    return "pbkdf2_sha256$500000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(derived).decode()

def verify_password(password: str, stored: str):
    try:
        algo, iterations, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        result = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(iterations))
        return hmac.compare_digest(result, base64.b64decode(hash_b64))
    except (ValueError, TypeError):
        return False

def _secret():
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32 or secret.startswith("REPLACE_THIS") or secret.startswith("YOUR_OWN"):
        raise RuntimeError("JWT_SECRET must be replaced with a new random secret of at least 32 characters")
    return secret

def create_token(user: User):
    payload = {"sub": user.id, "role": user.role, "exp": datetime.now(timezone.utc) + timedelta(hours=2)}
    return jwt.encode(payload, _secret(), algorithm="HS256")

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if credentials is None:
        raise HTTPException(401, "Sign in required")
    try:
        payload = jwt.decode(credentials.credentials, _secret(), algorithms=["HS256"])
        user = db.get(User, payload.get("sub"))
    except InvalidTokenError:
        user = None
    if user is None:
        raise HTTPException(401, "Invalid or expired session")
    return user

def require_roles(*roles):
    def dependency(user: User = Depends(current_user)):
        if user.role not in roles:
            raise HTTPException(403, "You do not have permission to perform this action")
        return user
    return dependency
