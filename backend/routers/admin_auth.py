from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.admin_middleware import require_admin

router = APIRouter(prefix="/admin-auth", tags=["admin-auth"])


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    username: str


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginRequest):
    # Delegates token verification to admin_auth_service
    from services.admin_auth_service import generate_admin_token, verify_admin_credentials

    if not verify_admin_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    token = generate_admin_token(body.username)
    return AdminLoginResponse(token=token, username=body.username)


@router.get("/me")
def admin_me(user=Depends(require_admin)):
    return {"ok": True, "user": user if isinstance(user, str) else None}
