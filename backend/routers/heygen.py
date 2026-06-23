"""
Router to proxy HeyGen API calls.
The HeyGen API key stays server-side; the frontend only receives
a short-lived session token.
"""

import os
import logging

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/heygen", tags=["heygen"])

HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY", "")


from pydantic import BaseModel
from typing import Optional

class TokenRequest(BaseModel):
    avatar_id: Optional[str] = None
    voice_id: Optional[str] = None


async def _liveavatar_get(path: str, *, require_api_key: bool = True) -> dict:
    if require_api_key and not HEYGEN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="HEYGEN_API_KEY is not configured on the server.",
        )

    url = f"https://api.liveavatar.com{path}"
    headers = {"X-API-KEY": HEYGEN_API_KEY} if HEYGEN_API_KEY else {}
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "LiveAvatar GET %s failed: %s – %s",
                path,
                exc.response.status_code,
                exc.response.text,
            )
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"LiveAvatar API error: {exc.response.text}",
            )
        except httpx.RequestError as exc:
            logger.error("LiveAvatar GET %s error: %s", path, exc)
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach LiveAvatar API: {exc}",
            )

    return resp.json()


@router.get("/languages")
async def list_languages():
    """Return supported LiveAvatar languages (code + display name)."""
    data = await _liveavatar_get("/v1/languages", require_api_key=False)
    return {"languages": data.get("data", [])}


@router.get("/avatar/{avatar_id}")
async def get_avatar(avatar_id: str):
    """Return avatar details including preview_url for the configured avatar."""
    data = await _liveavatar_get(f"/v1/avatars/{avatar_id}")
    avatar = data.get("data")
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found.")
    return {
        "id": avatar.get("id"),
        "name": avatar.get("name"),
        "preview_url": avatar.get("preview_url"),
    }


from middleware.auth_middleware import get_current_user
from fastapi import Depends

@router.post("/token")
async def create_streaming_token(
    req: TokenRequest = TokenRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    Call HeyGen's LiveAvatar /v1/sessions/token endpoint and return
    the short-lived session token to the frontend.
    """
    if not HEYGEN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="HEYGEN_API_KEY is not configured on the server.",
        )

    avatar_id = req.avatar_id or "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"
    voice_id = req.voice_id or "c2527536-6d1f-4412-a643-53a3497dada9"

    url = "https://api.liveavatar.com/v1/sessions/token"
    payload = {
        "mode": "FULL",
        "avatar_id": avatar_id,
        "avatar_persona": {
            "voice_id": voice_id,
        }
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                url,
                headers={
                    "X-API-KEY": HEYGEN_API_KEY,
                    "Content-Type": "application/json"
                },
                json=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "HeyGen token request failed: %s – %s",
                exc.response.status_code,
                exc.response.text,
            )
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"HeyGen API error: {exc.response.text}",
            )
        except httpx.RequestError as exc:
            logger.error("HeyGen token request error: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach HeyGen API: {exc}",
            )

    data = resp.json()
    token = data.get("data", {}).get("session_token")

    if not token:
        logger.error("HeyGen returned unexpected payload: %s", data)
        raise HTTPException(
            status_code=502,
            detail="HeyGen did not return a valid session token.",
        )

    return {"token": token}
