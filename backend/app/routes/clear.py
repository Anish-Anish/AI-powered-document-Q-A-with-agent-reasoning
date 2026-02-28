"""Clear route: reset vector DB, sessions, and documents."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.database import get_db
from app.services.vector_store import clear_all
from app.models.schemas import ClearResponse

router = APIRouter()


@router.delete("/clear", response_model=ClearResponse)
async def clear_all_data():
    """Clear vector DB / reset all sessions and documents."""
    db = get_db()

    # Count before clearing
    doc_count = await db.documents.count_documents({})
    session_count = await db.sessions.count_documents({})

    # Clear vector store
    chunks_cleared = clear_all()

    # Clear MongoDB collections
    await db.documents.delete_many({})
    await db.sessions.delete_many({})
    await db.stats.delete_many({})
    await db.activity.delete_many({})

    # Log the clear action (fresh activity log)
    await db.activity.insert_one({
        "action": "System cleared",
        "detail": f"Removed {doc_count} documents, {chunks_cleared} chunks, {session_count} sessions",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "clear",
    })

    return ClearResponse(
        status="success",
        cleared={
            "documents": doc_count,
            "chunks": chunks_cleared,
            "sessions": session_count,
        },
    )
