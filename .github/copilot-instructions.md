# Copilot Instructions — TSSLLM

## Build & Run

### Backend (Python/FastAPI, port 8000)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add GITHUB_TOKEN (classic PAT, ghp_*, no scopes)
uvicorn app.main:app --reload --port 8000
```

### Frontend (React/TypeScript/Vite, port 5173)

```bash
cd frontend
npm install
npm run dev
```

### Lint (frontend only, no backend linter configured)

```bash
cd frontend && npm run lint
```

### Production build (single deployable)

```powershell
.\build.ps1   # builds frontend, copies dist → backend/static
```

### E2E Tests (Playwright)

```bash
cd frontend
npx playwright install chromium   # first-time browser install
npm run test:e2e                  # runs tests (auto-starts backend + frontend)
```

- **Config**: `frontend/playwright.config.ts` — Chromium only, `webServer` auto-starts backend (uvicorn :8000) and frontend (vite :5173). Reuses existing servers locally; starts fresh in CI.
- **Test directory**: `frontend/e2e/` — test specs live here, fixtures in `frontend/e2e/fixtures/`.
- **Core flow test** (`core-flow.spec.ts`): Create workspace → New notebook → Upload VTT source → Ask question → Verify AI response references source content.
- **Timeouts**: 120s per test, 90s for LLM responses, 30s for assertions — generous because tests hit real GitHub Models API.
- **CI**: `.github/workflows/e2e.yml` runs on every push to `main` and on PRs. Uses `GITHUB_TOKEN` (auto-provided by Actions) for the GitHub Models API. Uploads Playwright HTML report as an artifact on failure.

## Architecture

Three-pane NotebookLLM-style app: **Sources** (left) → **Chat** (middle) → **Studio** (right). The data hierarchy is **Team → Workspace (notebook) → Sources/Chat/Artifacts**.

### API routing

All resource routes are nested under `/api/workspaces/{workspace_id}/...`. The workspace ID is a path parameter, not a header or query param. Teams live at `/api/teams`.

### Frontend API client pattern

`createApi(workspaceId)` is a factory that returns a scoped API object — it is **not** a singleton. The `Api` instance is created in `Layout.tsx` via `useMemo` and passed as props to all pane components. Do not import or call API functions directly from components; always go through the `api` prop.

### Real-time sync via WebSocket

`ws_manager.py` broadcasts `{type: 'sources_changed' | 'chat_message' | 'artifacts_changed'}` events over `/api/workspaces/{id}/ws`. The frontend hook `useWorkspaceSync` listens and increments `refreshKey` counters, which trigger refetches in child panes. Do not add polling — use this broadcast pattern.

### RAG pipeline (embedding_service.py → chat_service.py)

1. **Ingest**: Sources are parsed (`source_service.py`) and chunked on sentence/paragraph boundaries with overlap (`EmbeddingService.chunk_text`)
2. **Embed**: Chunks are embedded via `text-embedding-3-small` (GitHub Models API) and stored in `chroma_data/vectors.json` (flat JSON, not a vector DB)
3. **Retrieve**: `EmbeddingService.query()` computes cosine similarity, applies a `min_similarity=0.3` threshold, and guarantees per-source diversity in results
4. **HyDE**: Before retrieval, `ChatService` generates a hypothetical answer and embeds that alongside the raw question (toggle via `HYDE_ENABLED` env var)
5. **Generate**: Retrieved chunks are injected into the system prompt; the LLM (GPT-4o) answers with citations

Changing the chunking logic requires re-embedding all existing sources (delete and re-add them, or clear `vectors.json`).

### Database

SQLite via SQLAlchemy. Models in `backend/app/models/`. Schema migrations are done inline in `main.py` lifespan handler (ALTER TABLE if column missing). No Alembic.

### Demo seeding

On startup, `demo_seed.py` creates a demo team (ID `00000000-...`) with pre-loaded notebooks from `seed_data/` and `web_trust_data/`. It is idempotent — skips if the demo team already exists.

## Conventions

### Backend

- **Settings**: All config via `pydantic-settings` in `config.py`. Every setting maps to an env var (e.g., `hyde_enabled` ↔ `HYDE_ENABLED`). Defaults are for local dev; Azure overrides via App Settings.
- **Service layer**: Business logic lives in `backend/app/services/` (class with `@classmethod` methods). Routers in `backend/app/routers/` are thin — they validate input, call a service, and broadcast WS events.
- **Supported file types**: `.docx`, `.pdf`, `.vtt` for upload. URLs are scraped via BeautifulSoup. SharePoint URLs are detected (`.sharepoint.com`) and currently rejected with a user-friendly error.

### Frontend

- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin). Dark theme (`bg-gray-950`, `text-gray-100`). No CSS modules or styled-components.
- **Icons**: `lucide-react` for all icons.
- **Panels**: `react-resizable-panels` for the three-pane layout. Each panel is collapsible.
- **Markdown rendering**: `react-markdown` with `@tailwindcss/typography` prose classes.

### Deployment

Azure App Service (Linux, Python 3.11). `deploy.ps1` handles the full flow. Key Azure config:
- `SEED_DATA_DIR` must point to `/home/site/wwwroot/seed_data` (Oryx runtime resolves `__file__` to a temp path)
- Persistent storage paths: `DATABASE_URL=sqlite:////home/tssllm.db`, `CHROMA_PERSIST_DIR=/home/chroma_data`, `UPLOAD_DIR=/home/uploads`
