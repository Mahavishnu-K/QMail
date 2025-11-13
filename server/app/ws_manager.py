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

    async def connect(self, sid: str, user_id: str, user_email: str):
        """
        Handles a new user connecting. Associates their user_id with their sid
        and checks for any pending handshake requests for them.
        """
        self.active_users[user_id] = sid
        print(f"INFO: User '{user_email}' ({user_id}) connected with SID '{sid}'")
        
        pending_sessions = await session_service.get_pending_sessions_for_recipient(user_id)
        if pending_sessions:
            print(f"INFO: Found {len(pending_sessions)} pending session(s) for user {user_id}")
            for session in pending_sessions:
                await self.sio.emit(
                    'qkd_pending_request',
                    {
                        "from_email": session['initiator_email'],
                        "session_id": str(session['session_id']),
                        "from_id": str(session['initiator_id'])
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

        if event == "check_user_status":
            user_to_check_id = data.get("user_id")
            if not user_to_check_id:
                return

            is_online = user_to_check_id in self.active_users
            print(f"INFO: User {sender_id} is checking status of {user_to_check_id}. Online: {is_online}")

            sender_sid = self.active_users.get(sender_id)
            if sender_sid:
                await self.sio.emit('user_status_response', {
                    "user_id": user_to_check_id,
                    "is_online": is_online
                }, to=sender_sid)
            return
        
        if event == "store_pending_session":
            print(f"INFO: Received request from {sender_id} to store a pending session.")
            await session_service.create_pending_session(
                session_id=data.get("session_id"),
                initiator_id=data.get("initiator_id"),
                recipient_id=data.get("recipient_id"),
                initiator_email=data.get("initiator_email"),
                recipient_email=data.get("recipient_email")
            )
            return

        recipient_id = data.get("to")
        if not recipient_id:
            return

        if event == "qkd_initiate":
            if recipient_id in self.active_users:
                recipient_sid = self.active_users[recipient_id]
                print(f"INFO: Relaying live QKD initiation from {sender_id} to {recipient_id}")
                await self.sio.emit('qkd_initiate', data, to=recipient_sid)
            else:
                print(f"WARNING: Received a 'qkd_initiate' for an offline user ({recipient_id}). Ignoring. The client should have checked status first.")
                
        elif event == "new_mail_notification":
            if recipient_id in self.active_users:
                recipient_sid = self.active_users[recipient_id]
                folder_to_sync = data.get("folder", "INBOX") # Default to INBOX
                print(f"INFO: Relaying new mail notification to {recipient_id}. Triggering sync for folder '{folder_to_sync}'.")
                await self.sio.emit('force_sync', {"folder": folder_to_sync}, to=recipient_sid)
        # For all other messages in an ongoing handshake, just relay them
        elif event == "qkd_accept_pending":
            # This event is sent by a recipient (Bob) who has just come online.
            # 'recipient_id' in this context is the original sender (Alice).
            if recipient_id in self.active_users:
                original_sender_sid = self.active_users[recipient_id]
                session_id = data.get("session_id")
                
                print(f"INFO: Recipient {sender_id} accepted pending session {session_id}.")
                print(f"INFO: Nudging original sender {recipient_id} to re-initiate handshake.")

                # Tell Alice's client: "Bob is ready for this session. You can start now."
                await self.sio.emit('initiate_from_pending', {
                    "session_id": session_id,
                    "to": sender_id # The ID of Bob, who is now ready
                }, to=original_sender_sid)
        elif event.startswith('qkd_'):
            if recipient_id in self.active_users:
                recipient_sid = self.active_users[recipient_id]

                relay_payload = data.copy()
                # 2. Add the 'from' field so the recipient knows who it's from.
                relay_payload['from'] = sender_id

                await self.sio.emit(event, relay_payload, to=recipient_sid)
                
                # Clean up the pending session record once the handshake is fully complete
                if event == "qkd_handshake_complete":
                    session_id = data.get("session_id")
                    if session_id:
                        print(f"INFO: Handshake for session {session_id} complete. Deleting pending record.")
                        await session_service.delete_pending_session(session_id)