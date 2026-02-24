from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import sources, chat, artifacts

app = FastAPI(title="TSSLLM - Team Source Studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.include_router(sources.router, prefix="/api/sources", tags=["sources"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(artifacts.router, prefix="/api/artifacts", tags=["artifacts"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
