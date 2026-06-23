import asyncio
import numpy as np
from huggingface_hub import InferenceClient

from config import HF_API_KEY, HF_EMBEDDING_MODEL

EMBEDDING_DIM = 1536

client = InferenceClient(token=HF_API_KEY)

def _to_vectors(result) -> list[list[float]]:
    arr = np.array(result, dtype=float)
    if arr.ndim == 1:
        return [arr.tolist()]
    return [row.tolist() for row in arr]

def _pad_to_dim(vector: list[float]) -> list[float]:
    if len(vector) >= EMBEDDING_DIM:
        return vector[:EMBEDDING_DIM]
    return vector + [0.0] * (EMBEDDING_DIM - len(vector))

async def embed_text(text: str) -> list[float]:
    result = await asyncio.to_thread(
        client.feature_extraction,
        text,
        model=HF_EMBEDDING_MODEL,
    )
    return _pad_to_dim(_to_vectors(result)[0])

async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    result = await asyncio.to_thread(
        client.feature_extraction,
        texts,
        model=HF_EMBEDDING_MODEL,
    )
    return [_pad_to_dim(vec) for vec in _to_vectors(result)]
