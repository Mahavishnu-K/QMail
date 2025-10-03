from pydantic import BaseModel, Field
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    sub: UUID

    class Config:
        from_attributes = True