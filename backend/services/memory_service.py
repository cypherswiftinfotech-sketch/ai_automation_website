import logging
from typing import Optional
from config import supabase, anthropic_client

logger = logging.getLogger(__name__)

# Fallback in-memory storage
IN_MEMORY_USERS = {}
IN_MEMORY_CONVERSATIONS = {}

def get_or_create_user(user_id: str, name: str = None, email: str = None) -> dict:
    try:
        result = supabase.table("users").select("*").eq("id", user_id).execute()
        if result.data:
            return result.data[0]

        new_user = {"id": user_id}
        if name:
            new_user["name"] = name
        if email:
            new_user["email"] = email

        insert = supabase.table("users").insert(new_user).execute()
        return insert.data[0]
    except Exception as e:
        logger.warning(f"Supabase error in get_or_create_user, falling back to in-memory: {e}")
        if user_id in IN_MEMORY_USERS:
            return IN_MEMORY_USERS[user_id]
        new_user = {"id": user_id, "name": name or "Local User", "email": email or "local@example.com"}
        IN_MEMORY_USERS[user_id] = new_user
        return new_user


def fetch_past_summary(user_id: str) -> Optional[str]:
    try:
        result = (
            supabase.table("conversations")
            .select("summary")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["summary"]
        return None
    except Exception as e:
        logger.warning(f"Supabase error in fetch_past_summary, falling back to in-memory: {e}")
        return IN_MEMORY_CONVERSATIONS.get(user_id)


async def save_session_summary(user_id: str, conversation_text: str) -> None:
    summary = "Mock summary of the conversation."
    try:
        message = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=(
                "You are a memory assistant. Given a conversation between a user and an AI avatar, "
                "write a concise 3-5 sentence summary of the key topics the user asked about and "
                "any important context about them. Write in third person (e.g. 'The user asked about...')."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Summarise this conversation:\n\n{conversation_text}",
                }
            ],
        )
        summary = message.content[0].text
    except Exception as e:
        logger.warning(f"Anthropic error in save_session_summary, using default summary: {e}")

    try:
        supabase.table("conversations").insert(
            {"user_id": user_id, "summary": summary}
        ).execute()
    except Exception as e:
        logger.warning(f"Supabase error in save_session_summary, saving to in-memory: {e}")
        IN_MEMORY_CONVERSATIONS[user_id] = summary
