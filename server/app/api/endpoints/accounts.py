# app/api/endpoints/accounts.py
from fastapi import APIRouter, Depends, HTTPException
from app.api import deps
from app.schemas.user import User
from app.db.supabase_client import supabase
from app.services import email_service
from app.schemas.account import LinkedAccount 
from uuid import UUID
import httpx

router = APIRouter()

@router.get("/linked", response_model=list[LinkedAccount])
async def get_linked_accounts(current_user: User = Depends(deps.get_current_user)):
    """
    Fetches a list of all email accounts the current user has linked to QuMail.
    """
    try:
        response = supabase.table('linked_accounts').select("id, email_address, provider, created_at").eq('user_id', str(current_user.id)).execute()
        return response.data or []
    except Exception as e:
        print(f"Error fetching linked accounts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch linked accounts.")


@router.get("/{account_id}/sync-credentials", response_model=dict)
async def get_sync_credentials(account_id: str, current_user: User = Depends(deps.get_current_user)):
    """
    Securely fetches and provides temporary credentials for a specific linked
    account, allowing the client's background process to sync email.
    """
    try:
        response = supabase.table('linked_accounts').select('*').eq('id', account_id).eq('user_id', str(current_user.id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Linked account not found or you do not have permission to access it.")
        
        linked_account = response.data
        
        # Get a valid, fresh access token for OAuth2 sessions
        access_token = await email_service._get_valid_access_token_async(linked_account)
        
        return {
            "email": linked_account['email_address'],
            "provider": linked_account['provider'],
            "accessToken": access_token, 
            "imapServer": email_service.IMAP_SERVERS.get(linked_account['provider'])
        }

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            print(f"ERROR: Google rejected the refresh token for account {account_id}. Re-authentication is required.")
            raise HTTPException(
                status_code=401,
                detail="The stored authentication token from Google is no longer valid. Please go to Settings to re-link your account."
            )
        raise HTTPException(status_code=500, detail="An error occurred while communicating with the email provider.")
    
    except Exception as e:
        print(f"Error getting sync credentials: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve sync credentials.")
    
@router.delete("/{account_id}", status_code=200, response_model=dict)
async def remove_linked_account(account_id: UUID, current_user: User = Depends(deps.get_current_user)):
    try:
        response = supabase.table('linked_accounts') \
            .delete() \
            .eq('id', str(account_id)) \
            .eq('user_id', str(current_user.id)) \
            .execute()
         
        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Linked account not found or you do not have permission to remove it."
            )
        print(f"User {current_user.email} successfully removed linked account {account_id}")
        return {"message": "Linked account removed successfully."}
    except Exception as e:
        print(f"Error removing linked account {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")