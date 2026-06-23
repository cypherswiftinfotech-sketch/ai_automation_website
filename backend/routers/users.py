from typing import Optional
from fastapi import APIRouter, HTTPException
from models.schemas import UserCreate, UserResponse
from services.memory_service import get_or_create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/identify", response_model=UserResponse)
def identify_user(body: UserCreate, user_id: Optional[str] = None):
    import uuid

    uid = user_id or str(uuid.uuid4())
    try:
        user = get_or_create_user(uid, name=body.name, email=body.email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return UserResponse(id=user["id"], name=user.get("name"), email=user.get("email"))
