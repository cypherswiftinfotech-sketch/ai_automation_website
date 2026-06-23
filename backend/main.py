import logging
import sys
from pathlib import Path

# Ensure the backend directory is in the Python path for Vercel
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure logging so we see info/warning/error messages in the terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

import config  # noqa: E402,F401 — must be imported first to load .env
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import admin, users, query, heygen, auth, conversations, scheduling
from routers.admin_auth import router as admin_auth_router
from routers.admin_db import router as admin_db_router

app = FastAPI(title="LiveAvatar Consulting API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_auth_router)
app.include_router(admin.router)
app.include_router(admin_db_router)

app.include_router(users.router)
app.include_router(query.router)
app.include_router(heygen.router)
app.include_router(conversations.router)
app.include_router(scheduling.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug-config")
def debug_config():
    import os
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, HF_API_KEY, ANTHROPIC_API_KEY, anthropic_client
    return {
        "ENV_SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "ENV_SUPABASE_SERVICE_KEY_LEN": len(os.getenv("SUPABASE_SERVICE_KEY", "")),
        "ENV_SUPABASE_SERVICE_KEY_PREFIX": os.getenv("SUPABASE_SERVICE_KEY", "")[:10],
        "CONFIG_SUPABASE_URL": SUPABASE_URL,
        "CONFIG_SUPABASE_SERVICE_KEY_PREFIX": SUPABASE_SERVICE_KEY[:10] if SUPABASE_SERVICE_KEY else None,
        "CONFIG_HF_API_KEY_PREFIX": HF_API_KEY[:10] if HF_API_KEY else None,
        "CONFIG_ANTHROPIC_API_KEY_PREFIX": ANTHROPIC_API_KEY[:15] if ANTHROPIC_API_KEY else None,
        "CONFIG_ANTHROPIC_CLIENT_OK": anthropic_client is not None,
    }


@app.get("/debug/knowledge-status")
def knowledge_status():
    """Check how many knowledge chunks exist in the database."""
    from config import supabase
    try:
        res = supabase.table("knowledge_chunks").select("source_file, id", count="exact").execute()
        sources = {}
        for row in (res.data or []):
            src = row.get("source_file", "unknown")
            sources[src] = sources.get(src, 0) + 1
        return {
            "total_chunks": res.count,
            "sources": sources,
            "status": "ok",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}

