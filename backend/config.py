import logging
import os
from pathlib import Path
from typing import Optional

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from supabase import Client, create_client

# Try to load .env from the backend directory
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)

def get_env_stripped(key: str, default: Optional[str] = None) -> Optional[str]:
    val = os.getenv(key, default)
    if not val:
        return val
    # Strip whitespace, then strip any accidental surrounding quotes
    return val.strip().strip('"').strip("'")

# HuggingFace configs
HF_API_KEY = get_env_stripped("HF_API_KEY")
HF_EMBEDDING_MODEL = get_env_stripped("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# Anthropic
ANTHROPIC_API_KEY = get_env_stripped("ANTHROPIC_API_KEY")

# Supabase
SUPABASE_URL = get_env_stripped("SUPABASE_URL")
SUPABASE_SERVICE_KEY = get_env_stripped("SUPABASE_SERVICE_KEY")


logger = logging.getLogger(__name__)

def _supabase_key_looks_valid(key: Optional[str]) -> bool:
    if not key:
        return False
    parts = key.split(".")
    return len(parts) == 3 and "dummy" not in key.lower()


if not _supabase_key_looks_valid(SUPABASE_SERVICE_KEY):
    logger.warning(
        "SUPABASE_SERVICE_KEY is missing or invalid. "
        "Knowledge base and user data will use in-memory fallback. "
        "Set the service_role key from Supabase -> Project Settings -> API."
    )

try:
    anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except Exception as e:
    logger.error(f"Failed to initialize Anthropic client: {e}")
    anthropic_client = None

try:
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    else:
        supabase = None
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    supabase = None
