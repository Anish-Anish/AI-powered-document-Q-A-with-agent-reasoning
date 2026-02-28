"""Main FastAPI application for the GenAI Agentic RAG System."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, close_db
from app.routes import documents, query, dashboard, clear, settings
from app.config import get_runtime_settings
from app.database import get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    await connect_db()
    # Restore persisted runtime settings from MongoDB
    try:
        db = get_db()
        saved = await db.settings.find_one({"key": "runtime_settings"})
        if saved and "value" in saved:
            rs = get_runtime_settings()
            rs.update(**saved["value"])
    except Exception:
        pass  # First run or no saved settings — use defaults
    yield
    await close_db()


app = FastAPI(
    title="GenAI Agentic RAG System",
    description="A Python-based GenAI system with agentic RAG capabilities, "
                "document processing, and multi-turn chat.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(query.router, prefix="/api", tags=["Query & Chat"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(clear.router, prefix="/api", tags=["System"])
app.include_router(settings.router, prefix="/api", tags=["Settings"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "GenAI Agentic RAG System"}
