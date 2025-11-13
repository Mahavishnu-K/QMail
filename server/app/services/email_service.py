import httpx
import smtplib
import imaplib
import base64
import asyncio
from fastapi.concurrency import run_in_threadpool
from fastapi import HTTPException
from email.message import EmailMessage
from email.utils import formataddr
from app.core.config import settings
from app.core.constants import EmailProvider
from app.core.security import decrypt_token, encrypt_token
from app.db.supabase_client import supabase
from app.services import user_service
from app.schemas.email import EmailSend
from datetime import datetime, timedelta, timezone
from dateutil import parser


IMAP_SERVERS = {EmailProvider.GMAIL: "imap.gmail.com", EmailProvider.YAHOO: "imap.mail.yahoo.com"}
SMTP_SERVERS = {EmailProvider.GMAIL: "smtp.gmail.com", EmailProvider.YAHOO: "smtp.mail.yahoo.com"}
TOKEN_URIS = {
    EmailProvider.GMAIL: "https://oauth2.googleapis.com/token",
    EmailProvider.YAHOO: "https://api.login.yahoo.com/oauth2/get_token"
}

async def _refresh_and_update_tokens(linked_account: dict):
    """Async helper to perform the token refresh and DB update."""
    refresh_token = decrypt_token(linked_account['encrypted_refresh_token'])
    provider = linked_account['provider']

    client_id = settings.GOOGLE_CLIENT_ID if provider == EmailProvider.GMAIL else settings.YAHOO_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET if provider == EmailProvider.GMAIL else settings.YAHOO_CLIENT_SECRET
    
    token_data = {'client_id': client_id, 'client_secret': client_secret, 'refresh_token': refresh_token, 'grant_type': 'refresh_token'}
    
    async with httpx.AsyncClient() as client:
        res = await client.post(TOKEN_URIS[provider], data=token_data)
        res.raise_for_status()
        new_tokens = res.json()

    update_payload = {
        'encrypted_access_token': encrypt_token(new_tokens['access_token']),
        'token_expiry': (datetime.now(timezone.utc) + timedelta(seconds=new_tokens['expires_in'])).isoformat()
    }

    if 'refresh_token' in new_tokens:
        print(f"INFO: Received a new refresh token for {linked_account['email_address']}. Updating in DB.")
        # 3. If so, add it to our update payload.
        update_payload['encrypted_refresh_token'] = encrypt_token(new_tokens['refresh_token'])

    supabase.table('linked_accounts').update(update_payload).eq('id', linked_account['id']).execute()
    
    print(f"INFO: Token refresh successful for {linked_account['email_address']}")
    return new_tokens['access_token']

def _get_valid_access_token_sync(linked_account: dict) -> str:
    """
    Synchronous version of get_valid_access_token.
    Checks expiry and runs the async refresh function in a new event loop if needed.
    """
    expiry_time_str = linked_account.get('token_expiry')
    expiry_time = parser.isoparse(expiry_time_str) if expiry_time_str else None

    if not expiry_time or expiry_time < datetime.now(timezone.utc) + timedelta(seconds=60):
        print(f"INFO: Token needs refresh in synchronous context for {linked_account['email_address']}.")
        # Run the async refresh function in a new event loop
        # This is the standard pattern for calling async code from a sync function.
        return asyncio.run(_refresh_and_update_tokens(linked_account))
        
    return decrypt_token(linked_account['encrypted_access_token'])

async def _get_valid_access_token_async(linked_account: dict) -> str:
    """
    Checks if the stored access token is expired. If so, uses the refresh token
    to get a new one, updates the database, and returns the new token.
    Uses httpx for non-blocking network I/O.
    """
    expiry_time_str = linked_account.get('token_expiry')
    expiry_time =  parser.isoparse(expiry_time_str) if expiry_time_str else None

    if not expiry_time or expiry_time < (datetime.now(timezone.utc) + timedelta(seconds=60)):
        return await _refresh_and_update_tokens(linked_account)
        
    return decrypt_token(linked_account['encrypted_access_token'])

def _generate_oauth2_string(email: str, access_token: str) -> str:
    """Generates the XOAUTH2 authentication string for IMAP and SMTP."""
    return f"user={email}\1auth=Bearer {access_token}\1\1"

async def send_email(linked_account: dict, email_data: EmailSend):
    user_email = linked_account['email_address']
    qmail_user_profile = await user_service.get_user_by_id(user_id=str(linked_account['user_id']))
    if not qmail_user_profile:
        raise HTTPException(status_code=404, detail="Could not find the QMail user profile for this linked account.")
    
    display_name = qmail_user_profile['name']
    provider = linked_account['provider']
    
    smtp_host = SMTP_SERVERS.get(provider)
    if not smtp_host:
        raise HTTPException(status_code=500, detail=f"Unsupported provider: {provider}")
    
    access_token = await _get_valid_access_token_async(linked_account)
    auth_string = _generate_oauth2_string(user_email, access_token)
    xoauth_string = base64.b64encode(auth_string.encode('utf-8')).decode('ascii')
    
    msg = EmailMessage()
    msg['Subject'] = email_data.subject
    msg["From"] = formataddr((display_name, user_email))
    msg['To'] = email_data.recipient
    msg.set_content(email_data.body, subtype='plain', charset='utf-8')

    def _blocking_smtp_send():
        try:
            with smtplib.SMTP_SSL(smtp_host, 465) as server:
                server.ehlo()
                code, response = server.docmd("AUTH", "XOAUTH2 " + xoauth_string)

                if code != 235:  # 235 = Auth successful
                    detail = response.decode(errors="ignore")
                    print(f"SMTP AUTH ERROR: {code} - {detail}")
                    raise HTTPException(status_code=401, detail=f"Authentication failed: {detail}")

                server.send_message(msg)
            print(f"Successfully sent email from {user_email}")
        except smtplib.SMTPAuthenticationError as e:
            error_detail = e.smtp_error.decode() if hasattr(e.smtp_error, 'decode') else str(e.smtp_error)
            print(error_detail)
            raise HTTPException(status_code=401, detail=f"SMTP Authentication failed: {error_detail}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")
            
    await run_in_threadpool(_blocking_smtp_send)
    
def _execute_imap_command(linked_account: dict, folder: str, command, *args):
    """A helper function to handle the async IMAP connection and authentication."""
    user_email = linked_account['email_address']
    provider = linked_account['provider']
    imap = None
    try:
        access_token = _get_valid_access_token_sync(linked_account)
        auth_string = _generate_oauth2_string(user_email, access_token)

        imap = imaplib.IMAP4_SSL(host=IMAP_SERVERS.get(provider))
        imap.authenticate('XOAUTH2', lambda x: auth_string.encode('utf-8'))
        imap.select(f'"{folder}"')

        result = command(imap, *args)
        return result
    except Exception as e:
        print(f"ERROR in IMAP command execution: {e}")
        raise
    finally:
        if imap:
            try:
                imap.logout()
            except:
                pass

def imap_set_flag(imap, uid, flag):
    imap.uid('store', uid, '+FLAGS', flag)

def imap_remove_flag(imap, uid, flag):
    imap.uid('store', uid, '-FLAGS', flag)

def imap_move_email(imap, uid, destination):
    imap.uid('copy', uid, destination)
    imap.uid('store', uid, '+FLAGS', '(\\Deleted)')
    imap.expunge()

async def set_email_flag(linked_account: dict, folder: str, email_uid: str, flag: str):
    await run_in_threadpool(_execute_imap_command, linked_account, folder, imap_set_flag, email_uid, flag)
    print(f"Production: Set flag {flag} for email {email_uid}")

async def remove_email_flag(linked_account: dict, folder: str, email_uid: str, flag: str):
    await run_in_threadpool(_execute_imap_command, linked_account, folder, imap_remove_flag, email_uid, flag)
    print(f"Production: Removed flag {flag} for email {email_uid}")

async def move_email(linked_account: dict, current_folder: str, email_uid: str, destination_folder: str):
    await run_in_threadpool(_execute_imap_command, linked_account, current_folder, imap_move_email, email_uid, destination_folder)
    print(f"Production: Moved email {email_uid} to {destination_folder}")