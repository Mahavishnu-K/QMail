# app/api/endpoints/auth.py
import httpx 
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse,JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import datetime, timedelta
from urllib.parse import urlencode

from app.api import deps
from app.core import security
from app.core.constants import EmailProvider
from app.core.config import settings
from app.schemas.token import Token
from app.schemas.user import User, UserCreate
from app.services import user_service
from app.db.supabase_client import supabase

router = APIRouter()

# --- USER REGISTRATION, LOGIN, and PROFILE ---
@router.post("/register", response_model=User)
async def register(user_in: UserCreate):
    user = await user_service.get_user_by_email(email=user_in.email)
    if user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    new_user = await user_service.create_user(
        name=user_in.name, email=user_in.email, password=user_in.password
    )
    if not new_user:
        raise HTTPException(status_code=500, detail="Could not create user account.")
    return new_user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await user_service.authenticate_user(email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password, or this account must sign in with Google.",
        )
    
    # Use the user's UUID (id) as the token subject, as expected by deps.py
    access_token = security.create_access_token(data={"sub": str(user['id'])})

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def get_current_user_profile(current_user: User = Depends(deps.get_current_user)):
    return current_user

@router.post("/google/login", response_model=Token)
async def handle_google_signin(payload: dict):
    """
    Handles SIGNING IN or SIGNING UP via Google.
    This is a PUBLIC endpoint. It does not require a QuMail JWT.
    It takes a Google code, verifies it, finds or creates a QuMail user,
    and returns a QuMail JWT.
    """
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not found.")

    try:
        # Step 1: Exchange code for Google tokens
        async with httpx.AsyncClient() as client:
            token_uri = "https://oauth2.googleapis.com/token"
            token_data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                # THIS MUST BE THE SERVER'S REDIRECT URI for this flow
                "redirect_uri": "http://localhost:5173/auth/google/callback", 
                "grant_type": "authorization_code"
            }
            token_res = await client.post(token_uri, data=token_data)
            token_res.raise_for_status()
            tokens = token_res.json()

        # Step 2: Verify token and get user info
        id_info = id_token.verify_oauth2_token(tokens['id_token'], google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        email = id_info['email']
        name = id_info.get('name', 'Google User')

        user = await user_service.get_user_by_email(email=email)
        
        if not user:
            print(f"INFO: Creating new social user for {email}")
            user = await user_service.create_social_user(
                name=name, email=email, provider="google"
            )
        elif user.get('auth_provider') != 'google':
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please log in with your password."
            )
        
        if not user:
            raise HTTPException(status_code=500, detail="Failed to find or create user account.")
        
        # Step 4: Create and return a QuMail JWT for the session
        access_token = security.create_access_token(data={"sub": str(user['id'])})
        response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
        response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", secure=False)
        return response

    except Exception as e:
        print(f"ERROR during Google Sign-In: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during Google authentication.")
    
# --- SECURE ACCOUNT LINKING (for logged-in users) ---
@router.get("/google/link-url", response_model=dict)
async def get_google_link_url(current_user: User = Depends(deps.get_current_user)):
    """
    Generates the unique authorization URL for a logged-in user to link
    their Google account. This is a PROTECTED endpoint.
    """
    token = security.create_access_token(data={"sub": str(current_user.id)})
    redirect_uri = settings.GOOGLE_REDIRECT_URI 
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile email https://mail.google.com/",
        "access_type": "offline", "prompt": "consent",
        "login_hint": current_user.email,
        "state": token 
    }
    auth_url = f"{base_url}?{urlencode(params)}"
    return {"authorization_url": auth_url}

@router.get("/google/callback") 
async def handle_google_link_callback(code: str, state: str):
    """
    STEP 2: Handles the GET redirect from Google for a logged-in user.
    """
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not found in redirect.")
    
    current_user = await deps.get_current_user(token=state)
    try:
        async with httpx.AsyncClient() as client:
            token_uri = "https://oauth2.googleapis.com/token"
            token_data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI, # Must match step 1
                "grant_type": "authorization_code"
            }
            token_res = await client.post(token_uri, data=token_data)
            token_res.raise_for_status()
            tokens = token_res.json()

        id_info = id_token.verify_oauth2_token(tokens['id_token'], google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        email = id_info['email']

        # **THE FIX**: Added `await` to the Supabase call
        await supabase.table('linked_accounts').upsert({
            "user_id": str(current_user.id),
            "email_address": email,
            "provider": EmailProvider.GMAIL,
            "encrypted_access_token": security.encrypt_token(tokens['access_token']),
            "encrypted_refresh_token": security.encrypt_token(tokens['refresh_token']),
            "token_expiry": (datetime.utcnow() + timedelta(seconds=tokens['expires_in'])).isoformat()
        }).execute()

        # Redirect the user's browser back to the settings page in the client app
        return RedirectResponse(url="http://localhost:5173/settings?link_status=success")
        
    except Exception as e:
        print(f"ERROR during account linking: {e}")
        return RedirectResponse(url="http://localhost:5173/settings?link_status=error")

# --- OAUTH2 ACCOUNT LINKING FLOW ---

@router.post("/yahoo/callback")
async def handle_yahoo_callback(payload: dict, current_user: User = Depends(deps.get_current_user)):
    """
    Handles linking a Yahoo account via OAuth2.
    """
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not found.")

    try:
        async with httpx.AsyncClient() as client:
            token_uri = "https://api.login.yahoo.com/oauth2/get_token"
            
            # Yahoo requires Basic Auth for the client credentials
            auth_header = httpx.BasicAuth(settings.YAHOO_CLIENT_ID, settings.YAHOO_CLIENT_SECRET)
            
            token_data = {
                "code": code,
                "redirect_uri": settings.YAHOO_REDIRECT_URI,
                "grant_type": "authorization_code"
            }
            token_res = await client.post(token_uri, data=token_data, auth=auth_header)
            token_res.raise_for_status()
            tokens = token_res.json()

            # Use the access token to get the user's profile info
            profile_uri = "https://api.login.yahoo.com/openid/v1/userinfo"
            profile_res = await client.get(profile_uri, headers={"Authorization": f"Bearer {tokens['access_token']}"})
            profile_res.raise_for_status()
            profile_info = profile_res.json()
            email = profile_info['email']

        # Securely store the tokens
        supabase.table('linked_accounts').upsert({
            "user_id": str(current_user['id']),
            "email_address": email,
            "provider": EmailProvider.YAHOO,
            "encrypted_access_token": security.encrypt_token(tokens['access_token']),
            "encrypted_refresh_token": security.encrypt_token(tokens['refresh_token']),
            "token_expiry": (datetime.utcnow() + timedelta(seconds=tokens['expires_in'])).isoformat()
        }, on_conflict="user_id, email_address").execute()

        return {"message": f"Successfully linked Yahoo account: {email}"}
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Error exchanging code with Yahoo: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")