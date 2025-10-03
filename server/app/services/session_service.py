from app.db.supabase_client import supabase
from uuid import UUID

async def create_pending_session(initiator_id: UUID, recipient_id: UUID, initiator_email: str, recipient_email: str):
    """
    Creates a record of a pending handshake request in the database.
    """
    try:
        response = supabase.table('pending_sessions').insert({
            "initiator_id": str(initiator_id),
            "recipient_id": str(recipient_id),
            "initiator_email": initiator_email,
            "recipient_email": recipient_email,
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"ERROR: Could not create pending session: {e}")
        return None

async def get_pending_sessions_for_recipient(recipient_id: UUID):
    """
    Fetches all pending handshake requests for a user who has just come online.
    """
    try:
        response = supabase.table('pending_sessions').select("*").eq('recipient_id', str(recipient_id)).eq('status', 'pending').execute()
        return response.data
    except Exception as e:
        print(f"ERROR: Could not fetch pending sessions: {e}")
        return []

async def delete_pending_session(session_id: UUID):
    """
    Removes a pending session from the database, usually after it has been
    successfully completed or acknowledged.
    """
    try:
        supabase.table('pending_sessions').delete().eq('session_id', str(session_id)).execute()
        return True
    except Exception as e:
        print(f"ERROR: Could not delete pending session {session_id}: {e}")
        return False