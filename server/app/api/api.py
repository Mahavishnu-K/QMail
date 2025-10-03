from fastapi import APIRouter
from app.api.endpoints import auth, users, emails, accounts

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(emails.router, prefix="/emails", tags=["Emails"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"]) 