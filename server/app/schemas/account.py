# app/schemas/account.py
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class LinkedAccount(BaseModel):
    id: UUID
    email_address: EmailStr
    provider: str
    created_at: datetime

    class Config:
        from_attributes = True