"""
Admin inspector — read-only access to database tables for the admin panel.

Used by /admin/db/* endpoints to show what data is stored in Supabase so the
operator can confirm uploads, conversations, leads, bookings, etc.

The list of browsable tables is discovered at request time:

  * If migrations/005_admin_list_tables_rpc.sql has been applied, the
    ``public.admin_list_tables()`` SQL function returns every application
    table in the project — no Python change required when you add a new
    table to Supabase.
  * Otherwise, we probe a list of common table names and keep the ones that
    exist (so even without the RPC, every real table shows up).
  * A denylist of system / noisy tables keeps Supabase internals, auth
    tables, and PostgREST bookkeeping out of the panel.
"""

import logging
from typing import Any, Optional

from config import supabase

logger = logging.getLogger(__name__)


# Tables we never want to show in the admin panel: Supabase internals,
# PostgREST bookkeeping, and any other schema objects that would clutter the
# view without helping the operator understand their data.
DENIED_TABLES: set[str] = {
    # Supabase / PostgREST bookkeeping
    "schema_migrations",
    "supabase_migrations",
    "pg_stat_statements",
    "pg_stat_statements_info",
    # PostGIS / extensions
    "spatial_ref_sys",
    "geography_columns",
    "geometry_columns",
    "raster_columns",
    "raster_overviews",
    # Realtime / Supabase metadata
    "realtime.schema_migrations",
    "realtime.subscription",
    "realtime.messages",
    "storage.buckets",
    "storage.objects",
    "storage.migrations",
    "auth.users",
    "auth.identities",
    "auth.sessions",
    "auth.refresh_tokens",
    "auth.audit_log_entries",
    "auth.flow_state",
    "auth.mfa_factors",
    "auth.mfa_challenges",
    "auth.mfa_amr_claims",
    "auth.sso_providers",
    "auth.sso_domains",
    "auth.saml_providers",
    "auth.saml_relay_states",
    "auth.one_time_tokens",
}


# Columns whose values we replace with "***" before returning to the admin
# panel. These hold secrets or bulk blobs that would be expensive / risky to
# render in a browser.
REDACTED_COLUMNS: set[str] = {
    "password_hash",
    "token_hash",
    "session_token",
    "token",  # generic session / API tokens
    "auth_token",
    "reset_token",
    "magic_link_token",
    "verification_token",
    "embedding",
    "api_key",
    "secret",
    "access_token",
    "refresh_token",
    "id_token",
}


# Columns whose PostgREST type doesn't support ilike (uuid, jsonb, timestamps,
# numbers, booleans, etc.). Used to keep the substring search from 500-ing.
_NON_TEXT_TYPES = {"uuid", "json", "jsonb", "timestamp", "timestamptz", "date",
                   "time", "timetz", "interval", "boolean", "bool", "integer",
                   "int", "int2", "int4", "int8", "bigint", "smallint",
                   "numeric", "decimal", "real", "double", "float4", "float8",
                   "bytea", "inet", "cidr", "macaddr", "money"}


def _is_denied(table: str) -> bool:
    """Skip Supabase / extension / auth tables — show only user data."""
    if table in DENIED_TABLES:
        return True
    # Deny anything from the auth/storage/realtime/extensions schemas.
    if "." in table:
        schema = table.split(".", 1)[0].lower()
        if schema in {"auth", "storage", "realtime", "extensions", "pg_catalog", "information_schema", "pg_toast"}:
            return True
    return False


def _list_user_tables() -> list[str]:
    """Discover application tables dynamically.

    Order:
      1. ``public.admin_list_tables()`` RPC — installed by
         migrations/005_admin_list_tables_rpc.sql. Once the operator runs
         that SQL, every table in their project is enumerated automatically;
         no Python change is needed when a new table is added.
      2. A probe list — table names we try individually. If the RPC isn't
         installed we still show every table that actually exists in the
         project, by calling ``count(*)`` on each candidate and skipping the
         ones that 404.
      3. A small fallback list (only used when Supabase isn't configured).
    """
    fallback = [
        "users",
        "conversations",
        "messages",
        "leads",
        "conversation_state",
        "bookings",
        "knowledge_chunks",
        "global_settings",
        "login_form_info",
    ]

    # Candidate names probed when the RPC isn't installed. Mixes the
    # tables this project uses today with common Supabase-app conventions
    # so a typical project lights up every table without setup.
    probe_candidates = [
        "users",
        "profiles",
        "accounts",
        "auth.users",
        "conversations",
        "conversation",
        "chat_sessions",
        "sessions",
        "messages",
        "messages_v2",
        "leads",
        "lead",
        "conversation_state",
        "bookings",
        "booking",
        "appointments",
        "meetings",
        "knowledge_chunks",
        "documents",
        "document_chunks",
        "embeddings",
        "global_settings",
        "login_form_info",
        "settings",
        "system_settings",
        "app_settings",
        "notifications",
        "events",
        "audit_log",
        "organizations",
        "teams",
        "subscriptions",
        "payments",
    ]

    if supabase is None:
        return fallback

    # 1) Preferred: the SQL helper, if installed.
    try:
        res = supabase.rpc("admin_list_tables").execute()
        if res.data:
            seen: set[str] = set()
            out: list[str] = []
            for row in res.data:
                schema = (row.get("table_schema") or "public").lower()
                name = row.get("table_name") or ""
                if not name:
                    continue
                qualified = name if schema == "public" else f"{schema}.{name}"
                if _is_denied(qualified):
                    continue
                if qualified in seen:
                    continue
                seen.add(qualified)
                out.append(qualified)
            if out:
                return out
    except Exception as e:
        # PGRST202 = function not found in schema cache (RPC not installed).
        # Anything else is logged but non-fatal — we fall through to probing.
        msg = str(e)
        if "PGRST202" not in msg:
            logger.info("admin_list_tables RPC unavailable (%s); probing candidates", msg)

    # 2) Probe: try each candidate; only keep ones that actually exist.
    discovered: list[str] = []
    for name in probe_candidates:
        try:
            supabase.table(name).select("*", count="exact").limit(1).execute()
            if not _is_denied(name) and name not in discovered:
                discovered.append(name)
        except Exception:
            continue

    return discovered or fallback


def list_tables() -> list[dict[str, Any]]:
    """Return the list of browsable tables with current row counts."""
    names = _list_user_tables()

    if supabase is None:
        return [
            {"name": name, "row_count": None, "available": False}
            for name in names
        ]

    out: list[dict[str, Any]] = []
    for name in names:
        try:
            res = (
                supabase.table(name)
                .select("*", count="exact")
                .limit(1)
                .execute()
            )
            out.append(
                {
                    "name": name,
                    "row_count": res.count if res.count is not None else 0,
                    "available": True,
                }
            )
        except Exception as e:
            logger.warning("Failed to count rows in %s: %s", name, e)
            out.append({"name": name, "row_count": 0, "available": False})
    return out


def _redact_row(row: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for k, v in row.items():
        if k in REDACTED_COLUMNS:
            safe[k] = "***"
        else:
            safe[k] = v
    return safe


def get_table(
    name: str,
    *,
    limit: int = 50,
    offset: int = 0,
    q: Optional[str] = None,
) -> dict[str, Any]:
    """Return a page of rows from a single table.

    Supports a simple substring search across all text columns when ``q`` is
    provided. Always redacts sensitive columns.
    """
    if _is_denied(name):
        raise ValueError(f"Table '{name}' is not browsable")

    if supabase is None:
        return {
            "name": name,
            "rows": [],
            "total": 0,
            "columns": [],
            "available": False,
        }

    try:
        # Find candidate columns (cheap; one row's keys).
        sample = (
            supabase.table(name)
            .select("*")
            .limit(1)
            .execute()
        )
        sample_rows = sample.data or []
        all_columns: list[str] = list(sample_rows[0].keys()) if sample_rows else []

        # Total count.
        count_res = (
            supabase.table(name)
            .select("*", count="exact")
            .limit(1)
            .execute()
        )
        total = count_res.count if count_res.count is not None else 0

        query = (
            supabase.table(name)
            .select("*")
            .range(offset, offset + max(limit - 1, 0))
        )
        if q:
            # Filter only on columns that are likely to be text. UUID / jsonb /
            # timestamp columns break PostgREST's ilike with a 42883 error, and
            # we have no portable way to introspect types via the REST client.
            text_cols = [
                c for c in all_columns
                if c not in REDACTED_COLUMNS and not c.endswith("_id")
            ]
            or_clause = ",".join(f"{c}.ilike.%{q}%" for c in text_cols)
            if or_clause:
                query = query.or_(or_clause)

        try:
            res = query.execute()
        except Exception as e:
            # If the filter still hit a non-text column, retry with a
            # narrower column set based on common text-friendly names. We
            # build a fresh query object so the previous .or_() filter
            # doesn't leak through.
            logger.warning("Filter failed on %s with full text columns, retrying narrow: %s", name, e)
            text_hints = {
                "name", "title", "email", "subject", "status", "content",
                "message", "text", "description", "label", "slug",
                "username", "phone", "city", "country", "company",
                "intent", "stage", "role", "summary", "source_file",
                "source_url", "source", "language", "avatar_id",
                "notes", "comment", "comments", "bio", "tag", "tags",
                "address", "reason", "feedback",
            }
            text_cols = [c for c in all_columns if c in text_hints]
            retry = (
                supabase.table(name)
                .select("*")
                .range(offset, offset + max(limit - 1, 0))
            )
            or_clause = ",".join(f"{c}.ilike.%{q}%" for c in text_cols)
            if or_clause:
                retry = retry.or_(or_clause)
            res = retry.execute()
        rows = [_redact_row(r) for r in (res.data or [])]

        columns = all_columns or (list(rows[0].keys()) if rows else [])

        return {
            "name": name,
            "rows": rows,
            "total": total,
            "columns": columns,
            "available": True,
        }
    except Exception as e:
        logger.error("Failed to fetch rows from %s: %s", name, e)
        return {
            "name": name,
            "rows": [],
            "total": 0,
            "columns": [],
            "available": False,
            "error": str(e),
        }
