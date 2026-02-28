"""Settings routes: get/update runtime agent settings."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import get_runtime_settings, AVAILABLE_MODELS
from app.database import get_db

router = APIRouter()


class SettingsUpdate(BaseModel):
    llm_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    temperature: Optional[float] = None


@router.get("/settings")
async def get_settings():
    """Get current runtime settings and available models."""
    rs = get_runtime_settings()
    return {
        "settings": rs.to_dict(),
        "available_models": AVAILABLE_MODELS,
    }


@router.put("/settings")
async def update_settings(update: SettingsUpdate):
    """Update runtime settings. Changes take effect on the next query/upload."""
    rs = get_runtime_settings()

    # Validate model if provided
    if update.llm_model is not None:
        valid_ids = [m["id"] for m in AVAILABLE_MODELS]
        if update.llm_model not in valid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model: {update.llm_model}. Available: {valid_ids}",
            )

    # Validate chunk_size
    if update.chunk_size is not None:
        if update.chunk_size < 100 or update.chunk_size > 4000:
            raise HTTPException(status_code=400, detail="chunk_size must be between 100 and 4000")

    # Validate chunk_overlap
    if update.chunk_overlap is not None:
        if update.chunk_overlap < 0 or update.chunk_overlap > 500:
            raise HTTPException(status_code=400, detail="chunk_overlap must be between 0 and 500")
        target_chunk = update.chunk_size if update.chunk_size is not None else rs.chunk_size
        if update.chunk_overlap >= target_chunk:
            raise HTTPException(status_code=400, detail="chunk_overlap must be less than chunk_size")

    # Validate temperature
    if update.temperature is not None:
        if update.temperature < 0.0 or update.temperature > 2.0:
            raise HTTPException(status_code=400, detail="temperature must be between 0.0 and 2.0")

    # Apply updates
    rs.update(**update.model_dump(exclude_none=True))

    # Persist to MongoDB so settings survive restart
    db = get_db()
    await db.settings.update_one(
        {"key": "runtime_settings"},
        {"$set": {"value": rs.to_dict(), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    # Log activity
    changes = {k: v for k, v in update.model_dump(exclude_none=True).items()}
    await db.activity.insert_one({
        "action": "Settings updated",
        "detail": ", ".join(f"{k}={v}" for k, v in changes.items()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "settings",
    })

    return {
        "status": "success",
        "settings": rs.to_dict(),
        "message": "Settings updated. Changes take effect on the next query/upload.",
    }
