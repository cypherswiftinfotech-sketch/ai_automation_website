from fastapi import APIRouter, Depends, Query

from middleware.admin_middleware import require_admin
from services.admin_inspect_service import get_table, list_tables

router = APIRouter(prefix="/admin/db", tags=["admin-db"])


@router.get("/tables")
def admin_list_tables(_: str = Depends(require_admin)):
    """List all browsable tables with row counts.

    The set of tables is discovered from Supabase's information_schema so the
    admin panel reflects whatever the operator actually has in their project.
    """
    return {"tables": list_tables()}


@router.get("/table/{name}")
def admin_get_table(
    name: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None),
    _: str = Depends(require_admin),
):
    """Get a paginated, optionally-filtered view of a single table.

    Sensitive columns (password_hash, token_hash, embedding, etc.) are
    redacted automatically.
    """
    return get_table(name, limit=limit, offset=offset, q=q)
