-- Run this entire file in your Supabase SQL editor

-- Enable pgvector extension
create extension if not exists vector;

-- ── Users ──────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  created_at timestamptz default now()
);

-- ── Conversation summaries ─────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  summary text not null,
  created_at timestamptz default now()
);
create index if not exists conversations_user_id_idx on conversations(user_id);

-- ── Knowledge chunks ───────────────────────────────────
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_file text,
  created_at timestamptz default now()
);

-- Similarity search function (cosine distance)
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source_file text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    source_file,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── Leads (Phase 1: consultant intelligence) ───────────
-- See migrations/002_leads.sql for full migration
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  conversation_id uuid unique references conversations(id) on delete cascade,
  stage text not null default 'discover',
  score int not null default 0 check (score >= 0 and score <= 100),
  status text not null default 'cold',
  signals jsonb not null default '{}',
  qualified_fields jsonb not null default '{}',
  objections jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists leads_conversation_id_idx on leads(conversation_id);

-- ── Conversation state (Phase 2) ───────────────────────
create table if not exists conversation_state (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  turn_count int not null default 0,
  questions_asked jsonb not null default '[]',
  topics_discussed jsonb not null default '[]',
  stage_history jsonb not null default '[]',
  last_intent text,
  updated_at timestamptz default now()
);

-- ── Bookings (Phase 3) ─────────────────────────────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  timezone text not null default 'UTC',
  attendee_email text,
  attendee_name text,
  external_booking_id text,
  status text not null default 'confirmed',
  created_at timestamptz default now()
);
