import json
import re
from openai import OpenAI
from sqlalchemy.orm import Session
from app.models.chat import ChatMessage
from app.models.source import Source
from app.models.workspace import Workspace
from app.services.embedding_service import EmbeddingService
from app.config import settings

_GREETING_PATTERN = re.compile(
    r"^(h(i|ello|ey|owdy)|greetings|good\s*(morning|afternoon|evening)|what'?s\s*up|sup|yo)[\s!.,?]*$",
    re.IGNORECASE,
)

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
    def _get_reset_at(cls, db: Session, workspace_id: str):
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        return ws.chat_reset_at if ws else None

    @classmethod
    def get_messages(cls, db: Session, workspace_id: str) -> list[ChatMessage]:
        query = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id)
        reset_at = cls._get_reset_at(db, workspace_id)
        if reset_at:
            query = query.filter(ChatMessage.created_at > reset_at)
        return query.order_by(ChatMessage.created_at.asc()).all()

    @classmethod
    def send_message(cls, db: Session, user_content: str, workspace_id: str, source_ids: list[int] | None = None) -> ChatMessage:
        # Save user message
        user_msg = ChatMessage(role="user", content=user_content, workspace_id=workspace_id)
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        # Handle greetings with a friendly capability overview
        if _GREETING_PATTERN.match(user_content.strip()):
            sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
            if sources:
                source_samples = []
                for s in sources:
                    text = (s.content_text or "").strip()
                    if text:
                        source_samples.append(f"- {s.name}: {text[:500]}")
                source_info = "\n".join(source_samples) or "\n".join(f"- {s.name}" for s in sources)
                system_prompt = (
                    "You are a friendly research assistant. The user just greeted you. "
                    "Respond warmly and briefly explain that you can help them analyze their sources — "
                    "answer questions, compare across sources, summarize key points, and create artifacts.\n\n"
                    "Then, based on the source material below, suggest 3-5 specific, insightful questions "
                    "the user could ask about their sources. Make the suggestions diverse and useful.\n\n"
                    f"SOURCES:\n{source_info}"
                )
            else:
                system_prompt = (
                    "You are a friendly research assistant. The user just greeted you. "
                    "Respond warmly, then use **bold** and bullet points to clearly list what you can help with:\n"
                    "- **Analyze sources** — answer questions grounded in uploaded documents\n"
                    "- **Compare across sources** — find similarities and differences\n"
                    "- **Summarize key points** — extract the most important insights\n"
                    "- **Create artifacts** — draft markdown documents from research\n\n"
                    "End by letting them know they should start by adding some sources "
                    "(docx files or URLs) in the **Sources pane** on the left. "
                    "Use markdown formatting in your response for readability."
                )
            source_names = []
            contexts = None
        else:
            # Determine how many chunks to retrieve based on source count
            if source_ids is not None:
                num_sources = len(source_ids)
            else:
                num_sources = db.query(Source).filter(Source.workspace_id == workspace_id).count()
            n_results = max(15, num_sources * 3)

            # Retrieve relevant context from sources
            contexts = EmbeddingService.query(user_content, n_results=n_results, source_ids=source_ids, workspace_id=workspace_id)

            # Build system prompt with context
            if contexts:
                source_names = list(set(c["metadata"]["source_name"] for c in contexts))
                context_text = "\n\n---\n\n".join(
                    f"[Source: {c['metadata']['source_name']}]\n{c['text']}" for c in contexts
                )
                source_list = "\n".join(f"- {name}" for name in source_names)
                system_prompt = (
                    "You are a helpful research assistant. Answer the user's question based on the provided source material. "
                    "You MUST reference and address ALL of the following sources in your response — do not skip any:\n\n"
                    f"{source_list}\n\n"
                    "For each source, include relevant findings or insights. If a source does not contain information "
                    "relevant to the question, briefly note that. Always cite sources by name.\n\n"
                    f"SOURCE MATERIAL:\n{context_text}"
                )
            else:
                source_names = []
                system_prompt = (
                    "You are a helpful research assistant. No sources have been added yet. "
                    "Let the user know they should add some sources first for the best experience, "
                    "but still try to help with their question using your general knowledge."
                )

        # Build conversation history (last 20 messages to stay within token limits)
        history_query = db.query(ChatMessage).filter(
            ChatMessage.workspace_id == workspace_id
        )
        reset_at = cls._get_reset_at(db, workspace_id)
        if reset_at:
            history_query = history_query.filter(ChatMessage.created_at > reset_at)
        history = history_query.order_by(ChatMessage.created_at.asc()).all()
        # Exclude the user message we just saved (it's the last one)
        history = history[:-1]
        # Keep last 20 messages to avoid token overflow
        history = history[-20:]

        # Call OpenAI
        client = cls._get_client()
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_content})

        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            max_tokens=16000,
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

    @classmethod
    def generate_followups(cls, db: Session, workspace_id: str) -> list[str]:
        """Generate follow-up questions based on the current conversation."""
        history_query = db.query(ChatMessage).filter(
            ChatMessage.workspace_id == workspace_id
        )
        reset_at = cls._get_reset_at(db, workspace_id)
        if reset_at:
            history_query = history_query.filter(ChatMessage.created_at > reset_at)
        history = history_query.order_by(ChatMessage.created_at.desc()).limit(10).all()
        history.reverse()

        if not history:
            return []

        conversation = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:1000]}" for m in history
        )

        client = cls._get_client()
        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Based on the conversation below, suggest exactly 3 follow-up questions the user could ask. "
                        "Focus on deeper analysis of the sources, identifying key insights, comparisons across sources, "
                        "or actionable takeaways. The questions should be specific, diverse, and build on what was already discussed. "
                        "Return ONLY a JSON array of 3 strings, no other text."
                    ),
                },
                {"role": "user", "content": conversation},
            ],
            temperature=0.7,
            max_tokens=300,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            followups = json.loads(raw)
            if isinstance(followups, list):
                return [str(s) for s in followups[:3]]
        except json.JSONDecodeError:
            pass
        return []
