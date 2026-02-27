import json
import os
import re
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
    def _embed(cls, texts: list[str], batch_size: int = 100) -> list[list[float]]:
        client = cls._get_client()
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = client.embeddings.create(model=settings.embedding_model, input=batch)
            all_embeddings.extend(item.embedding for item in response.data)
        return all_embeddings

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        if not text:
            return []

        # Split into sentences (preserve the delimiter at the end of each sentence)
        sentence_pattern = re.compile(r'(?<=[.!?])\s+|\n{2,}')
        sentences = sentence_pattern.split(text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            return []

        chunks: list[str] = []
        current_sentences: list[str] = []
        current_len = 0

        for sentence in sentences:
            sent_len = len(sentence)

            # If a single sentence exceeds chunk_size, split it by characters
            if sent_len > chunk_size:
                # Flush current buffer first
                if current_sentences:
                    chunks.append(" ".join(current_sentences))
                    current_sentences = []
                    current_len = 0
                # Character-level fallback for oversized sentences
                start = 0
                while start < sent_len:
                    end = start + chunk_size
                    piece = sentence[start:end].strip()
                    if piece:
                        chunks.append(piece)
                    start += chunk_size - overlap
                continue

            # Would adding this sentence exceed the chunk size?
            new_len = current_len + (1 if current_sentences else 0) + sent_len
            if new_len > chunk_size and current_sentences:
                chunks.append(" ".join(current_sentences))
                # Overlap: carry trailing sentences whose total length <= overlap
                overlap_sentences: list[str] = []
                overlap_len = 0
                for s in reversed(current_sentences):
                    if overlap_len + len(s) + (1 if overlap_sentences else 0) > overlap:
                        break
                    overlap_sentences.insert(0, s)
                    overlap_len += len(s) + (1 if len(overlap_sentences) > 1 else 0)
                current_sentences = overlap_sentences
                current_len = sum(len(s) for s in current_sentences) + max(0, len(current_sentences) - 1)

            current_sentences.append(sentence)
            current_len += (1 if len(current_sentences) > 1 else 0) + sent_len

        # Flush remaining
        if current_sentences:
            chunks.append(" ".join(current_sentences))

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
    def query(cls, query_text: str, n_results: int = 15, source_ids: list[int] | None = None, workspace_id: str | None = None, min_similarity: float = 0.3) -> list[dict]:
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
            if sim >= min_similarity:
                scored.append((sim, entry))
        if not scored:
            return []
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
                "similarity": sim,
                "distance": 1.0 - sim,
            })
        return results
