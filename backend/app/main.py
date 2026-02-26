import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
from app.routers import workspaces, sources, chat, artifacts

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Add chat_reset_at column if missing (migration for existing DBs)
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        columns = [c["name"] for c in inspect(engine).get_columns("workspaces")]
        if "chat_reset_at" not in columns:
            conn.execute(text("ALTER TABLE workspaces ADD COLUMN chat_reset_at TIMESTAMP NULL"))
            conn.commit()
    yield

app = FastAPI(title="TSS LLM - Trust and Security Services", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
app.include_router(sources.router, prefix="/api/workspaces/{workspace_id}/sources", tags=["sources"])
app.include_router(chat.router, prefix="/api/workspaces/{workspace_id}/chat", tags=["chat"])
app.include_router(artifacts.router, prefix="/api/workspaces/{workspace_id}/artifacts", tags=["artifacts"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Serve frontend static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA catch-all: serve index.html for any non-API route."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
