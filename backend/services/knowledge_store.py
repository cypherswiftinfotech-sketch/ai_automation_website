import numpy as np

IN_MEMORY_KNOWLEDGE: list[dict] = []

# Cypherswift recognition (email-domain based)
CYPHERSWIFT_DOMAIN_SUFFIX = "@cypherswift.com"


def store_chunks(rows: list[dict], *, company_id: str | None = None) -> int:
    # Keep chunks company-tagged for later filtering (in-memory fallback mode).
    for row in rows:
        IN_MEMORY_KNOWLEDGE.append(
            {
                "content": row["content"],
                "embedding": row["embedding"],
                "source_file": row.get("source_file", ""),
                "company_id": company_id,
            }
        )
    return len(rows)


def search_chunks(query_embedding: list[float], top_k: int = 5, *, company_id: str | None = None) -> list[str]:
    if not IN_MEMORY_KNOWLEDGE:
        return []

    query = np.array(query_embedding, dtype=float)
    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return []

    scores: list[tuple[float, str]] = []
    for chunk in IN_MEMORY_KNOWLEDGE:
        if company_id is not None and chunk.get("company_id") not in (None, company_id):
            continue
        vector = np.array(chunk["embedding"], dtype=float)
        vector_norm = np.linalg.norm(vector)
        if vector_norm == 0:
            continue
        similarity = float(np.dot(query, vector) / (query_norm * vector_norm))
        scores.append((similarity, chunk["content"]))

    scores.sort(reverse=True, key=lambda item: item[0])
    return [content for _, content in scores[:top_k]]
