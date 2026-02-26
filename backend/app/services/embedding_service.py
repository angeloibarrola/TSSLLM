import json
import os
import numpy as np
from openai import OpenAI
from app.config import settings

STORE_PATH = os.path.join(settings.chroma_persist_dir, "vectors.json")


class EmbeddingService:
    _client: OpenAI | None = None
    _store: list[dict] | None = None

    @classmethod
    def _get_client(cls) -> OpenAI:
        if cls._client is None:
            cls._client = OpenAI(
                base_url=settings.llm_base_url,
                api_key=settings.github_token,
            )
        return cls._client

    @classmethod
    def _load_store(cls) -> list[dict]:
        if cls._store is None:
            if os.path.exists(STORE_PATH):
                with open(STORE_PATH, "r") as f:
                    cls._store = json.load(f)
            else:
                cls._store = []
        return cls._store

    @classmethod
    def _save_store(cls):
        os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
        with open(STORE_PATH, "w") as f:
            json.dump(cls._store or [], f)

    @classmethod
    def _embed(cls, texts: list[str]) -> list[list[float]]:
        client = cls._get_client()
        response = client.embeddings.create(model=settings.embedding_model, input=texts)
        return [item.embedding for item in response.data]

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        if not text:
            return []
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start += chunk_size - overlap
        return chunks

    @classmethod
    def add_source(cls, source_id: int, source_name: str, text: str, workspace_id: str = ""):
        store = cls._load_store()
        chunks = cls.chunk_text(text)
        if not chunks:
            return
        embeddings = cls._embed(chunks)
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            store.append({
                "id": f"ws-{workspace_id}-source-{source_id}-chunk-{i}",
                "text": chunk,
                "embedding": emb,
                "metadata": {"source_id": source_id, "source_name": source_name, "chunk_index": i, "workspace_id": workspace_id},
            })
        cls._save_store()

    @classmethod
    def remove_source(cls, source_id: int):
        store = cls._load_store()
        cls._store = [e for e in store if e["metadata"]["source_id"] != source_id]
        cls._save_store()

    @classmethod
    def query(cls, query_text: str, n_results: int = 15, source_ids: list[int] | None = None, workspace_id: str | None = None) -> list[dict]:
        store = cls._load_store()
        if not store:
            return []
        candidates = store
        # Filter by workspace_id to prevent cross-notebook leakage
        if workspace_id is not None:
            candidates = [e for e in candidates if e["metadata"].get("workspace_id") == workspace_id]
        # Filter by source_ids if provided
        if source_ids is not None:
            candidates = [e for e in candidates if e["metadata"]["source_id"] in source_ids]
        if not candidates:
            return []
        query_emb = cls._embed([query_text])[0]
        query_vec = np.array(query_emb)
        # Cosine similarity
        scored = []
        for entry in candidates:
            entry_vec = np.array(entry["embedding"])
            sim = float(np.dot(query_vec, entry_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(entry_vec) + 1e-10))
            scored.append((sim, entry))
        scored.sort(key=lambda x: x[0], reverse=True)

        # Ensure per-source coverage: pick top chunk from each source first
        seen_sources: set[int] = set()
        guaranteed: list[tuple[float, dict]] = []
        remaining: list[tuple[float, dict]] = []
        for sim, entry in scored:
            src_id = entry["metadata"]["source_id"]
            if src_id not in seen_sources:
                seen_sources.add(src_id)
                guaranteed.append((sim, entry))
            else:
                remaining.append((sim, entry))

        # Fill up to n_results: guaranteed first, then remaining by similarity
        selected = guaranteed[:n_results]
        for item in remaining:
            if len(selected) >= n_results:
                break
            selected.append(item)

        results = []
        for sim, entry in selected:
            results.append({
                "id": entry["id"],
                "text": entry["text"],
                "metadata": entry["metadata"],
                "distance": 1.0 - sim,
            })
        return results
