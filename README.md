# TSSLLM — Team Source Studio

A collaborative, NotebookLLM-style web application with three panes for importing sources, asking AI-powered questions, and creating markdown artifacts.

## Features

- **Sources Pane (Left):** Upload `.docx` files or add URLs to build your knowledge base
- **Chat Pane (Middle):** Ask questions and get AI answers grounded in your sources (RAG)
- **Studio Pane (Right):** Create and edit markdown documents from your research

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Python + FastAPI |
| LLM | GitHub Models (GPT-4o) via GitHub PAT |
| Embeddings | OpenAI text-embedding-3-small via GitHub Models + NumPy cosine similarity |
| Database | SQLite (SQLAlchemy) |
| Styling | Tailwind CSS v4 |

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **GitHub Personal Access Token (classic)** — Go to https://github.com/settings/tokens/new, no scopes needed, click "Generate token". Must be a **classic** token (starts with `ghp_`), not fine-grained.

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN
```

### Frontend

```bash
cd frontend
npm install
```

## Running

### Start the backend (port 8000)

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Start the frontend (port 5173)

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Description | Default |
|---|---|---|
| `GITHUB_TOKEN` | Your GitHub Personal Access Token | *(required)* |
| `LLM_BASE_URL` | LLM inference endpoint | `https://models.inference.ai.azure.com` |
| `CHAT_MODEL` | Chat completion model name | `gpt-4o` |
| `EMBEDDING_MODEL` | Embedding model name | `text-embedding-3-small` |
| `DATABASE_URL` | SQLite connection string | `sqlite:///./tssllm.db` |
| `CHROMA_PERSIST_DIR` | Directory for vector storage | `./chroma_data` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |

## Usage

1. **Add Sources:** Upload `.docx` files or paste URLs in the left pane
2. **Ask Questions:** Type questions in the chat pane — answers cite your sources
3. **Create Artifacts:** Click + in the Studio pane to create markdown notes; edit and save

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sources` | List all sources |
| POST | `/api/sources/upload` | Upload a .docx file |
| POST | `/api/sources/url` | Add a URL source |
| DELETE | `/api/sources/:id` | Delete a source |
| GET | `/api/chat` | Get chat history |
| POST | `/api/chat` | Send a message |
| GET | `/api/artifacts` | List artifacts |
| POST | `/api/artifacts` | Create an artifact |
| PUT | `/api/artifacts/:id` | Update an artifact |
| DELETE | `/api/artifacts/:id` | Delete an artifact |
| GET | `/api/health` | Health check |
