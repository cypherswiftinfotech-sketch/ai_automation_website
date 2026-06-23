"""
Conversations router — conversation history listing and message retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from middleware.auth_middleware import get_current_user
from services.conversation_service import (
    end_conversation,
    get_conversation_by_id,
    get_conversation_messages,
    get_user_conversations,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/")
def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """
    List all conversations for the authenticated user (paginated).
    Returns conversations with message counts, sorted by most recent.
    """
    conversations = get_user_conversations(
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )
    return {
        "conversations": conversations,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single conversation's details."""
    conv = get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    # Ensure the conversation belongs to the authenticated user
    if conv.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation.",
        )

    return conv


@router.get("/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all messages in a conversation (paginated).
    Messages are returned in chronological order (oldest first).
    """
    # Verify ownership
    conv = get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    if conv.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation.",
        )

    messages = get_conversation_messages(
        conversation_id=conversation_id,
        limit=limit,
        offset=offset,
    )
    return {
        "conversation_id": conversation_id,
        "messages": messages,
        "limit": limit,
        "offset": offset,
    }


@router.post("/{conversation_id}/end")
async def end_conversation_endpoint(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    End a conversation — generates a summary and marks it as ended.
    """
    conv = get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    if conv.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation.",
        )
    if conv.get("status") == "ended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation is already ended.",
        )

    result = await end_conversation(conversation_id)
    return {
        "message": "Conversation ended and summary generated.",
        **result,
    }
