from fastapi import APIRouter, HTTPException, Depends
from app.schemas.user import UserCreate, User
from app.services import user_service
from app.api import deps

router = APIRouter()

@router.post("/signup", response_model=User, status_code=201)
def create_new_user(user: UserCreate):
    """
    Handle new user registration.
    """
    db_user = user_service.get_user_by_email(email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    created_user = user_service.create_user(user=user)
    if not created_user:
        raise HTTPException(status_code=500, detail="Could not create user account.")
        
    return created_user

@router.get("/check", response_model=dict)
async def check_user_exists(email: str, current_user: User = Depends(deps.get_current_user)):
    user = await user_service.get_user_by_email(email=email)
    if user:
        return {"is_qumail_user": True, "user_id": str(user['id'])}
    else:
        return {"is_qumail_user": False, "user_id": None}