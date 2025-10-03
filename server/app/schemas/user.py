from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: UUID
    auth_provider: Optional[str] = None  
    created_at: datetime
    class Config:
        from_attributes = True