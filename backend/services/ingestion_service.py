import logging
import os
import traceback

from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import supabase
from services.embedding_service import embed_texts
from services.knowledge_store import store_chunks
from utils.document_parser import extract_text

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 80
BATCH_SIZE = 20  # Insert in batches to avoid request size limits

# Use absolute path for debug log so it's always findable
LOG_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEBUG_LOG = os.path.join(LOG_DIR, "ingest_debug.log")
ERROR_LOG = os.path.join(LOG_DIR, "supabase_error.txt")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
)


def _write_log(msg: str):
    """Write to debug log with absolute path."""
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


async def ingest_document(file_bytes: bytes, filename: str) -> int:
    _write_log(f"=== ingest_document called for '{filename}' ({len(file_bytes)} bytes) ===")

    try:
        raw_text = extract_text(file_bytes, filename)
        _write_log(f"Extracted text length: {len(raw_text)}")
    except Exception as e:
        _write_log(f"ERROR extracting text: {e}\n{traceback.format_exc()}")
        raise

    chunks = splitter.split_text(raw_text)
    _write_log(f"Split into {len(chunks)} chunks")

    if not chunks:
        _write_log("No chunks produced, returning 0")
        return 0

    try:
        embeddings = await embed_texts(chunks)
        _write_log(f"Generated {len(embeddings)} embeddings, dim={len(embeddings[0]) if embeddings else 0}")
    except Exception as e:
        _write_log(f"ERROR generating embeddings: {e}\n{traceback.format_exc()}")
        raise

    rows = [
        {
            "content": chunk,
            "embedding": embedding,
            "source_file": filename,
        }
        for chunk, embedding in zip(chunks, embeddings)
    ]

    _write_log(f"Prepared {len(rows)} rows for insert")

    # First, remove old chunks from the same source file to avoid duplicates
    try:
        supabase.table("knowledge_chunks").delete().eq(
            "source_file", filename
        ).execute()
        _write_log(f"Deleted old chunks for source_file='{filename}'")
    except Exception as e:
        _write_log(f"WARNING: Could not delete old chunks: {e}")

    # Insert in batches to avoid request size limits
    total_inserted = 0
    try:
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            res = supabase.table("knowledge_chunks").insert(batch).execute()
            batch_inserted = len(res.data) if res.data else 0
            total_inserted += batch_inserted
            _write_log(
                f"Supabase batch {i // BATCH_SIZE + 1}: "
                f"inserted {batch_inserted}/{len(batch)} rows"
            )
        _write_log(f"Supabase insert SUCCESS: {total_inserted} total rows inserted")
    except Exception as e:
        error_msg = f"Supabase insert FAILED: {e}\n{traceback.format_exc()}"
        _write_log(error_msg)
        logger.error(f"Supabase insert failed: {e}")
        try:
            with open(ERROR_LOG, "w", encoding="utf-8") as f:
                f.write(error_msg)
        except Exception:
            pass
        # Re-raise so the admin UI sees the actual error instead of a false success
        raise RuntimeError(
            f"Failed to store chunks in database: {e}. "
            f"Successfully inserted {total_inserted}/{len(rows)} before failure."
        ) from e

    return total_inserted
