from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from uuid import UUID


# ── Auth Schemas ─────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: "UserResponse"
    token: str
    expires_at: str


# ── User Schemas ─────────────────────────────────────────────


class UserCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    name: Optional[str]
    email: Optional[str]


# ── Query Schemas ────────────────────────────────────────────


class QueryRequest(BaseModel):
    user_id: str
    query: str
    language: Optional[str] = "en"
    conversation_id: Optional[str] = None
    timezone: Optional[str] = "UTC"


class QueryResponse(BaseModel):
    answer: str
    user_id: str
    conversation_id: Optional[str] = None
    intent: str = "rag_answer"
    lead_score: int = 0
    stage: str = "discover"
    status: str = "cold"
    score_delta: int = 0
    ui_action: Optional[dict] = None


# ── Ingestion Schemas ────────────────────────────────────────


class IngestResponse(BaseModel):
    message: str
    chunks_stored: int

# ── Settings Schemas ─────────────────────────────────────────

class SettingsRequest(BaseModel):
    avatar_name: Optional[str] = None
    avatar_intro: Optional[str] = None
    system_prompt: Optional[str] = None
    consultant_playbook: Optional[str] = None
    qualification_questions: Optional[List[str]] = None
    escalation_threshold: Optional[int] = Field(default=None, ge=0, le=100)
    book_meeting_threshold: Optional[int] = Field(default=None, ge=0, le=100)

class SettingsResponse(BaseModel):
    avatar_name: str
    avatar_intro: str
    system_prompt: str
    consultant_playbook: Optional[str] = ""
    qualification_questions: Optional[List[str]] = []
    escalation_threshold: Optional[int] = 75
    book_meeting_threshold: Optional[int] = 60
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
