"""
Auth router — handles user registration, login, logout, and session validation.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UserResponse,
)
from services.auth_service import login_user, logout_user, register_user
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    """Register a new user account."""
    try:
        user = register_user(
            name=body.name,
            email=body.email,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return UserResponse(
        id=user["id"],
        name=user.get("name"),
        email=user.get("email"),
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request):
    """Authenticate and create a session. Returns a Bearer token."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        result = login_user(
            email=body.email,
            password=body.password,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return LoginResponse(
        user=UserResponse(
            id=result["user"]["id"],
            name=result["user"]["name"],
            email=result["user"]["email"],
        ),
        token=result["token"],
        expires_at=result["expires_at"],
    )


@router.post("/logout")
def logout(request: Request):
    """Invalidate the current session token."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No Bearer token provided.",
        )

    token = auth_header.split(" ", 1)[1]
    success = logout_user(token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already expired.",
        )

    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        name=current_user.get("name"),
        email=current_user.get("email"),
    )
