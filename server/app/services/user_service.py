from app.db.supabase_client import supabase
from app.core.security import get_password_hash, verify_password
from typing import Optional

async def get_user_by_email(email: str) -> Optional[dict]:
    """
    Asynchronously fetches a single user record by their email address.
    Returns the user data dict or None if not found.
    """
    try:
        # The .execute() call is a network operation and MUST be awaited.
        response = supabase.table('users').select("*").eq('email', email).single().execute()
        return response.data
    except Exception:
        return None

async def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    Asynchronously fetches a single user record by their UUID.
    This is required for token authentication (deps.py).
    Returns the user data dict or None if not found.
    """
    try:
        response = supabase.table('users').select("*").eq('id', user_id).single().execute()
        return response.data
    except Exception:
        return None

async def create_user(name: str, email: str, password: str):
    """
    Asynchronously creates a new user in the 'users' table.
    Takes primitive types as arguments for better separation of concerns.
    Returns the newly created user data (without the password hash).
    """
    hashed_password = get_password_hash(password)
    
    # We now correctly include the 'name' field as required by your register endpoint.
    new_user_data = {
        "name": name,
        "email": email.lower(),
        "password_hash": hashed_password,
        "auth_provider": "email"
    }
    
    try:
        response = supabase.table('users').insert(new_user_data).execute()
        
        if response.data:
            created_user = response.data[0]
            # Best practice: Do not return the password hash, even if it's hashed.
            del created_user['password_hash']
            return created_user
            
    except Exception as e:
        # This can happen if the email is not unique (violates table constraint).
        print(f"Error creating user in Supabase: {e}")
        return None
    
async def create_social_user(name: str, email: str, provider: str):
    """
    Creates a new user for social sign-ins.
    Does NOT store a password.
    """
    new_user_data = {
        "name": name,
        "email": email.lower(),
        "password_hash": None, 
        "auth_provider": provider 
    }
    
    try:
        response = supabase.table('users').insert(new_user_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating social user: {e}")
        return None

async def authenticate_user(email: str, password: str):
    """
    Asynchronously authenticates a user.
    1. Fetches the user by email.
    2. Verifies the provided password against the stored hash.
    Returns the user data dict if successful, otherwise None.
    """
    user = await get_user_by_email(email=email)

    # If no user exists with that email, authentication fails.
    if not user:
        return None
        
    if user.get('auth_provider') != 'email':
        return None
    
    # If the password does not match the hash, authentication fails.
    if not verify_password(password, user['password_hash']):
        return None
        
    # Authentication successful
    return user