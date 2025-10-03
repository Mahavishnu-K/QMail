from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from .config import settings

# --- Password Hashing for QuMail User Accounts ---
# We use bcrypt, the industry standard for hashing passwords.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if not settings.TOKEN_ENCRYPTION_KEY:
    raise ValueError("TOKEN_ENCRYPTION_KEY is not set in the environment.")

try:
    fernet = Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())
except Exception as e:
    raise ValueError(f"Invalid TOKEN_ENCRYPTION_KEY: {e}")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against its hashed version."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password for storage."""
    return pwd_context.hash(password)

# --- JWT Token Handling ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JSON Web Token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

fernet = Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())

def encrypt_data(data: str) -> str:
    return fernet.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    return fernet.decrypt(encrypted_data.encode()).decode()

def encrypt_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    return fernet.decrypt(encrypted_token.encode()).decode()