from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError

from app.core.config import settings
from app.services import user_service
from app.schemas.token import TokenData
from app.schemas.user import User
from typing import Optional

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenData(**payload)
    except (JWTError, ValidationError):
        raise credentials_exception
    
    user = await user_service.get_user_by_id(user_id=str(token_data.sub))
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_user_from_token_ws(token: str = Query(...)) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenData(**payload)
        if token_data is None:
            return None
        user_dict = await user_service.get_user_by_id(user_id=str(token_data.sub))
        if user_dict:
            user_model = User(**user_dict)
            return {"token": token, "user": user_model}
        return None
    except (JWTError, ValidationError):
        return None