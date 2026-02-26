import json
from openai import OpenAI
from sqlalchemy.orm import Session
from app.models.chat import ChatMessage
from app.models.source import Source
from app.services.embedding_service import EmbeddingService
from app.config import settings

class ChatService:
    _client = None

    @classmethod
    def _get_client(cls) -> OpenAI:
        if cls._client is None:
            cls._client = OpenAI(
                base_url=settings.llm_base_url,
                api_key=settings.github_token,
            )
        return cls._client

    @classmethod
    def get_messages(cls, db: Session, workspace_id: str) -> list[ChatMessage]:
        return db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).order_by(ChatMessage.created_at.asc()).all()

    @classmethod
    def send_message(cls, db: Session, user_content: str, workspace_id: str, source_ids: list[int] | None = None) -> ChatMessage:
        # Save user message
        user_msg = ChatMessage(role="user", content=user_content, workspace_id=workspace_id)
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        # Retrieve relevant context from sources
        contexts = EmbeddingService.query(user_content, n_results=5, source_ids=source_ids, workspace_id=workspace_id)

        # Build system prompt with context
        if contexts:
            source_names = list(set(c["metadata"]["source_name"] for c in contexts))
            context_text = "\n\n---\n\n".join(
                f"[Source: {c['metadata']['source_name']}]\n{c['text']}" for c in contexts
            )
            system_prompt = (
                "You are a helpful research assistant. Answer the user's question based on the provided source material. "
                "Always cite which sources you used. If the sources don't contain relevant information, say so.\n\n"
                f"SOURCE MATERIAL:\n{context_text}"
            )
        else:
            source_names = []
            system_prompt = (
                "You are a helpful research assistant. No sources have been added yet. "
                "Let the user know they should add some sources first for the best experience, "
                "but still try to help with their question using your general knowledge."
            )

        # Call OpenAI
        client = cls._get_client()
        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
            max_tokens=2000,
        )

        assistant_content = response.choices[0].message.content

        # Save assistant message
        assistant_msg = ChatMessage(
            role="assistant",
            content=assistant_content,
            workspace_id=workspace_id,
            sources_cited=json.dumps(source_names) if source_names else None,
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return assistant_msg

    @classmethod
    def generate_suggestions(cls, db: Session, workspace_id: str) -> list[str]:
        sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
        if not sources:
            return []

        # Sample content from each source (cap at ~2000 chars each)
        content_samples = []
        for s in sources:
            text = (s.content_text or "").strip()
            if text:
                content_samples.append(f"[{s.name}]: {text[:2000]}")
        if not content_samples:
            return []

        combined = "\n\n---\n\n".join(content_samples)
        # Cap total context to avoid token limits
        combined = combined[:8000]

        client = cls._get_client()
        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Based on the following source material, suggest exactly 3 specific, useful questions "
                        "a user could ask about this content. The questions should be diverse and help the user "
                        "extract key insights. Return ONLY a JSON array of 3 strings, no other text."
                    ),
                },
                {"role": "user", "content": combined},
            ],
            temperature=0.7,
            max_tokens=300,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            suggestions = json.loads(raw)
            if isinstance(suggestions, list):
                return [str(s) for s in suggestions[:3]]
        except json.JSONDecodeError:
            pass
        return []
