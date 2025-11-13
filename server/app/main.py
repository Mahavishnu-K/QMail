from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.ws_manager import ConnectionManager
import socketio
from socketio import AsyncServer, ASGIApp
from typing import Dict
from app.schemas.user import User
from app.api.deps import get_user_from_token_ws

from app.api.api import api_router

sio = AsyncServer(async_mode='asgi',  cors_allowed_origins="*")


app = FastAPI(
    title="QMail API",
    description="Backend services for the QuMail secure email client."
)

app_asgi = ASGIApp(sio, other_asgi_app=app, socketio_path='socket.io')

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Routers ---

app.include_router(api_router, prefix="/api")

manager = ConnectionManager(sio)

@sio.event
async def connect(sid, environ, auth):
    try:
        token_str = auth.get("token") if auth else None
        if not token_str:
            print("No token")
            return False

        token_data = await get_user_from_token_ws(token=token_str)
        if not token_data or not token_data.get("user"):
            print("WARNING: WebSocket connection attempt with invalid token.")
            return False 

        
        user: User = token_data["user"]
        user_id = str(user.id)
        user_email = user.email

        await manager.connect(sid, user_id, user_email)
        await sio.save_session(sid, {'user_id': user_id, 'user_email': user_email})
        print(f"WebSocket connected: user_id={user_id}, sid={sid}")
        return True
    
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        return False

@sio.event
async def disconnect(sid):
    try:
        session = await sio.get_session(sid)
        if session:
            await manager.disconnect(session['user_id'])
            print(f"WebSocket disconnected: user_id={session['user_id']}, sid={sid}")
    except Exception as e:
        print(f"WebSocket disconnection error: {e}")

@sio.on('*')
async def catch_all(event, sid, data):

    allowed_prefixes = ['qkd_', 'check_', 'new_', 'store_']

    if any(event.startswith(prefix) for prefix in allowed_prefixes):
        session = await sio.get_session(sid)
        if session:
            sender_id = session['user_id']
            sender_email = session['user_email']
            await manager.handle_message(event, data, sender_id, sender_email)

@app.get("/")
def read_root():
    return {"status": "QuMail API is running"}