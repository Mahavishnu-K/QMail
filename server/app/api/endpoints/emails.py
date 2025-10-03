from fastapi import APIRouter, Depends, HTTPException
from app.schemas.email import EmailSend
from pydantic import BaseModel
from app.api import deps
from app.schemas.user import User
from app.api import deps
from app.services import email_service
from app.db.supabase_client import supabase

class EmailActionPayload(BaseModel):
    folder: str

router = APIRouter()

async def get_user_linked_account(current_user: User = Depends(deps.get_current_user)):
    try:
        response = supabase.table('linked_accounts').select('*').eq('user_id', str(current_user.id)).limit(1).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="No linked email account found for this user.")
        return response.data
    except Exception as e:
        print(f"Error fetching linked account for user {current_user.id}: {e}")
        raise HTTPException(status_code=404, detail="No linked email account found for this user.")

@router.post("/send", status_code=202)
async def send_email_endpoint(
    email_in: EmailSend,
    linked_account: dict = Depends(get_user_linked_account)
):
    try:
        await email_service.send_email(
            linked_account=linked_account,
            recipient=email_in.recipient,
            subject=email_in.subject,
            body=email_in.body
        )
        return {"message": "Email has been accepted for delivery."}
    except HTTPException as e:
        raise e 
    except Exception as e:
        print(f"ERROR in /send endpoint: {e}")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while sending the email.")
    
@router.post("/{email_id}/delete")
async def delete_email_endpoint(email_id: str, payload: EmailActionPayload, linked_account: dict = Depends(get_user_linked_account)):
    trash_folder = "[Gmail]/Trash" if linked_account['provider'] == 'gmail' else 'Trash'
    await email_service.move_email(linked_account, payload.folder, email_id, trash_folder)
    return {"message": f"Email {email_id} moved to trash."}

@router.post("/{email_id}/archive")
async def archive_email_endpoint(email_id: str, payload: EmailActionPayload, linked_account: dict = Depends(get_user_linked_account)):
    archive_folder = "[Gmail]/All Mail" if linked_account['provider'] == 'gmail' else 'Archive'
    await email_service.move_email(linked_account, payload.folder, email_id, archive_folder)
    return {"message": f"Email {email_id} archived."}

@router.post("/{email_id}/read")
async def mark_as_read_endpoint(email_id: str, payload: EmailActionPayload, linked_account: dict = Depends(get_user_linked_account)):
    await email_service.set_email_flag(linked_account, payload.folder, email_id, '(\\Seen)')
    return {"message": f"Email {email_id} marked as read."}

@router.post("/{email_id}/star")
async def star_email_endpoint(email_id: str, payload: EmailActionPayload, linked_account: dict = Depends(get_user_linked_account)):
    await email_service.set_email_flag(linked_account, payload.folder, email_id, '(\\Flagged)')
    return {"message": f"Email {email_id} starred."}

@router.post("/{email_id}/unstar")
async def unstar_email_endpoint(email_id: str, payload: EmailActionPayload, linked_account: dict = Depends(get_user_linked_account)):
    await email_service.remove_email_flag(linked_account, payload.folder, email_id, '(\\Flagged)')
    return {"message": f"Email {email_id} unstarred."}

