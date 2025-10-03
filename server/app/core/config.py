from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    JWT_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 
    TOKEN_ENCRYPTION_KEY: str

    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Google OAuth Credentials
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # Yahoo OAuth Credentials
    YAHOO_CLIENT_ID: Optional[str] = None
    YAHOO_CLIENT_SECRET: Optional[str] = None
    YAHOO_REDIRECT_URI: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()