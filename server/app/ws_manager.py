# app/ws_manager.py

from typing import Dict
from app.services import session_service

class ConnectionManager:
    """
    Manages real-time user connections and orchestrates the QKD handshake relay,
    including the store-and-forward mechanism for offline users.
    """
    def __init__(self, sio):
        self.sio = sio  
        self.active_users: Dict[str, str] = {}

    async def connect(self, sid: str, user_id: str):
        """
        Handles a new user connecting. Associates their user_id with their sid
        and checks for any pending handshake requests for them.
        """
        self.active_users[user_id] = sid
        print(f"INFO: User '{user_id}' connected with SID '{sid}'")
        
        pending_sessions = await session_service.get_pending_sessions_for_recipient(user_id)
        if pending_sessions:
            print(f"INFO: Found {len(pending_sessions)} pending session(s) for user {user_id}")
            for session in pending_sessions:
                await self.sio.emit(
                    'qkd_pending_request',
                    {
                        "from_email": session['initiator_email'],
                        "session_id": session['session_id']
                    },
                    to=sid 
                )

    async def disconnect(self, user_id: str):
        """Handles a user disconnecting."""
        if user_id in self.active_users:
            del self.active_users[user_id]
            print(f"INFO: User '{user_id}' disconnected.")

    async def handle_message(self, event: str, data: dict, sender_id: str, sender_email: str):
        """
        The central message handler. It decides whether to relay a message
        directly or to store it as a pending session.
        """
        recipient_id = data.get("to")
        if not recipient_id:
            return

        if event == "qkd_initiate":
            if recipient_id in self.active_users:
                recipient_sid = self.active_users[recipient_id]
                print(f"INFO: Relaying live QKD initiation from {sender_id} to {recipient_id}")
                await self.sio.emit('qkd_initiate', data, to=recipient_sid)
            else:
                print(f"WARNING: Recipient {recipient_id} is offline. Storing pending session.")
                recipient_email = data.get("to_email") # The client must provide this
                if recipient_email:
                    await session_service.create_pending_session(
                        initiator_id=sender_id,
                        recipient_id=recipient_id,
                        initiator_email=sender_email,
                        recipient_email=recipient_email
                    )
                    # Notify the sender (Alice) that their request has been queued
                    sender_sid = self.active_users.get(sender_id)
                    if sender_sid:
                        await self.sio.emit('qkd_recipient_offline', {
                            "recipient_email": recipient_email
                        }, to=sender_sid)
        
        # For all other messages in an ongoing handshake, just relay them
        elif event.startswith('qkd_'):
            if recipient_id in self.active_users:
                recipient_sid = self.active_users[recipient_id]
                await self.sio.emit(event, data, to=recipient_sid)
                
                # Clean up the pending session record once the handshake is fully complete
                if event == "qkd_complete":
                    session_id = data.get("session_id")
                    if session_id:
                        await session_service.delete_pending_session(session_id)