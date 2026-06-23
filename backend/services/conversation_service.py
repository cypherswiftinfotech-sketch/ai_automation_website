"""
Conversation service — manages conversations and message storage.
Every Q&A turn is persisted for full conversation history retrieval.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from config import supabase, anthropic_client

logger = logging.getLogger(__name__)


# In-memory storage for local dev / demo without Supabase
_memory_conversations = {}
_memory_messages = []

# ── Conversation Management ─────────────────────────────────


def create_conversation(
    user_id: str,
    language: str = "en",
    avatar_id: Optional[str] = None,
    title: Optional[str] = None,
) -> dict:
    """
    Create a new conversation session.
    Returns the created conversation row.
    """
    import uuid
    data = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "language": language,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "summary": "New conversation"
    }
    if avatar_id:
        data["avatar_id"] = avatar_id
    if title:
        data["title"] = title

    if not supabase:
        _memory_conversations[data["id"]] = data
        return data

    try:
        supabase.table("users").upsert([{"id": user_id}]).execute()
    except Exception as e:
        logger.warning(f"Could not upsert user {user_id}: {e}")

    result = supabase.table("conversations").insert(data).execute()
    if not result.data:
        # fallback if db fails
        _memory_conversations[data["id"]] = data
        return data

    return result.data[0]


def get_active_conversation(user_id: str) -> Optional[dict]:
    """
    Get the most recent active conversation for a user.
    """
    if not supabase:
        user_convs = [c for c in _memory_conversations.values() if c.get("user_id") == user_id and c.get("status") == "active"]
        if user_convs:
            user_convs.sort(key=lambda x: x.get("started_at", ""), reverse=True)
            return user_convs[0]
        return None

    try:
        result = (
            supabase.table("conversations")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        return None


def get_or_create_conversation(
    user_id: str,
    language: str = "en",
    avatar_id: Optional[str] = None,
) -> dict:
    """
    Get the active conversation or create a new one.
    """
    conv = get_active_conversation(user_id)
    if conv:
        return conv
    return create_conversation(user_id, language=language, avatar_id=avatar_id)


# ── Message Storage ──────────────────────────────────────────


def save_message(
    conversation_id: str,
    role: str,
    content: str,
    token_count: Optional[int] = None,
    response_time_ms: Optional[float] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Save a single message (user or assistant) to the messages table.
    """
    msg = {"role": role, "content": content, "conversation_id": conversation_id}

    if not supabase:
        _memory_messages.append(msg)
        return msg

    data = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
    }
    if token_count is not None:
        data["token_count"] = token_count
    if response_time_ms is not None:
        data["response_time_ms"] = response_time_ms
    if metadata:
        data["metadata"] = metadata

    try:
        result = supabase.table("messages").insert(data).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to save {role} message for conversation {conversation_id}: {e}")

    _memory_messages.append(msg)
    return msg


# ── End Session ──────────────────────────────────────────────


async def end_conversation(conversation_id: str) -> dict:
    """
    End a conversation:
    1. Fetch all messages
    2. Generate summary via Claude
    3. Auto-generate title from first user message
    4. Update conversation status to 'ended'
    """
    if not supabase:
        raise RuntimeError("Database is not configured.")

    # Fetch all messages in this conversation
    messages_result = (
        supabase.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )

    messages = messages_result.data or []

    if not messages:
        # No messages — just mark as ended
        supabase.table("conversations").update(
            {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", conversation_id).execute()
        return {"conversation_id": conversation_id, "summary": None}

    # Build conversation transcript
    transcript = "\n".join(
        f"{msg['role'].upper()}: {msg['content']}" for msg in messages
    )

    # Generate summary via Claude
    summary = _generate_fallback_title(messages)
    if anthropic_client:
        try:
            response = await anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=(
                    "You are a memory assistant. Given a conversation between a user "
                    "and an AI avatar, write a concise 3-5 sentence summary of the key "
                    "topics the user asked about and any important context. "
                    "Write in third person (e.g. 'The user asked about...')."
                ),
                messages=[
                    {
                        "role": "user",
                        "content": f"Summarise this conversation:\n\n{transcript}",
                    }
                ],
            )
            summary = response.content[0].text
        except Exception as e:
            logger.warning(f"Claude summary generation failed: {e}")
            summary = f"Conversation with {len(messages)} messages."

    # Auto-generate title from first user message
    first_user_msg = next(
        (m["content"] for m in messages if m["role"] == "user"), None
    )
    title = first_user_msg[:80] + "..." if first_user_msg and len(first_user_msg) > 80 else first_user_msg

    # Update conversation
    update_data = {
        "summary": summary,
        "status": "ended",
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }
    if title:
        update_data["title"] = title

    supabase.table("conversations").update(update_data).eq(
        "id", conversation_id
    ).execute()

    logger.info(f"Ended conversation {conversation_id}")
    return {"conversation_id": conversation_id, "summary": summary, "title": title}


def _generate_fallback_title(messages: list) -> str:
    """Generate a simple fallback title from the first user message."""
    first_user_msg = next(
        (m["content"] for m in messages if m["role"] == "user"), "Untitled"
    )
    return first_user_msg[:60] if first_user_msg else "Untitled conversation"


# ── History Retrieval ────────────────────────────────────────


def get_user_conversations(
    user_id: str, limit: int = 20, offset: int = 0
) -> list:
    """
    Get paginated list of conversations for a user.
    Returns conversations with message counts.
    """
    if not supabase:
        return []

    try:
        result = supabase.rpc(
            "get_user_conversations",
            {"p_user_id": user_id, "p_limit": limit, "p_offset": offset},
        ).execute()
        return result.data or []
    except Exception as e:
        logger.warning(f"RPC get_user_conversations failed, using fallback: {e}")
        # Fallback: simple query without message counts
        result = (
            supabase.table("conversations")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []


def get_conversation_messages(
    conversation_id: str, limit: int = 100, offset: int = 0
) -> list:
    """
    Get paginated messages for a specific conversation.
    """
    if not supabase:
        msgs = [m for m in _memory_messages if m.get("conversation_id") == conversation_id]
        return msgs[offset:offset + limit]

    try:
        result = supabase.rpc(
            "get_conversation_messages",
            {
                "p_conversation_id": conversation_id,
                "p_limit": limit,
                "p_offset": offset,
            },
        ).execute()
        return result.data or []
    except Exception as e:
        logger.warning(f"RPC get_conversation_messages failed, using fallback: {e}")
        result = (
            supabase.table("messages")
            .select("id, role, content, metadata, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []


def get_conversation_by_id(conversation_id: str) -> Optional[dict]:
    """Get a single conversation by ID."""
    if not supabase:
        return None

    result = (
        supabase.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
