from pydantic import BaseModel, EmailStr

class EmailAccountBase(BaseModel):
    email_address: EmailStr
    imap_server: str
    smtp_server: str

class EmailAccountCreate(EmailAccountBase):
    app_password: str

class EmailAccount(EmailAccountBase):
    id: str
    user_id: str
    class Config:
        from_attributes = True

class EmailSend(BaseModel):
    recipient: EmailStr
    subject: str
    body: str 
    is_encrypted: bool
    protocol: str