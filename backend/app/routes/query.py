"""Query and chat routes: single query, multi-turn chat, sessions."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.services.agent import run_agent_query
from app.models.schemas import (
    QueryRequest, QueryResponse, Source, ReasoningStep,
    ChatRequest, ChatResponse, ChatMessageOut,
    SessionOut, SessionListResponse,
)

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Ask a question → agent decides retrieval strategy → return cited answer + reasoning trace."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    db = get_db()

    # Run the agent
    result = await run_agent_query(request.question)

    # Build response
    sources = [Source(**s) for s in result["sources"]]
    reasoning_trace = [ReasoningStep(**r) for r in result["reasoning_trace"]]

    # Log activity
    strategy_label = "RAG used" if result["retrieval_used"] else "Direct LLM"
    await db.activity.insert_one({
        "action": "Query processed",
        "detail": f'"{request.question[:50]}..." — {strategy_label}',
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "query",
        "strategy": result.get("strategy", "unknown"),
    })

    # Update query count
    await db.stats.update_one(
        {"key": "query_count"},
        {"$inc": {"value": 1}},
        upsert=True,
    )

    return QueryResponse(
        answer=result["answer"],
        sources=sources,
        reasoning_trace=reasoning_trace,
        retrieval_used=result["retrieval_used"],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Multi-turn conversation with session ID (maintains context)."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    db = get_db()

    # Get or create session
    session_id = request.session_id
    session = None

    if session_id:
        session = await db.sessions.find_one({"session_id": session_id})

    if not session:
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        session = {
            "session_id": session_id,
            "title": request.message[:40] + ("..." if len(request.message) > 40 else ""),
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.sessions.insert_one(session)

    # Build chat history for context
    chat_history = []
    for msg in session.get("messages", []):
        chat_history.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    # Add user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": request.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Run agent with conversation history
    result = await run_agent_query(request.message, chat_history=chat_history)

    # Build assistant message
    assistant_msg = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": result["answer"],
        "sources": result["sources"],
        "reasoning": result["reasoning_trace"],
        "retrieval_used": result["retrieval_used"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Update session in MongoDB
    turn = len(session.get("messages", [])) // 2 + 1
    await db.sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )

    # Log activity
    await db.activity.insert_one({
        "action": "Chat message",
        "detail": f"Session {session_id[:12]} — Turn {turn}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "chat",
    })

    # Update query count
    await db.stats.update_one(
        {"key": "query_count"},
        {"$inc": {"value": 1}},
        upsert=True,
    )

    sources = [Source(**s) for s in result["sources"]]
    reasoning_trace = [ReasoningStep(**r) for r in result["reasoning_trace"]]

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        sources=sources,
        reasoning_trace=reasoning_trace,
        retrieval_used=result["retrieval_used"],
        turn=turn,
    )


# --- Session Management ---

@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions():
    """List all chat sessions."""
    db = get_db()
    sessions_cursor = db.sessions.find({}, {"_id": 0}).sort("updated_at", -1)
    sessions = await sessions_cursor.to_list(length=100)

    session_list = []
    for s in sessions:
        messages_out = []
        for msg in s.get("messages", []):
            sources_raw = msg.get("sources", [])
            reasoning_raw = msg.get("reasoning", [])
            messages_out.append(ChatMessageOut(
                id=msg.get("id", ""),
                role=msg["role"],
                content=msg["content"],
                sources=[Source(**src) for src in sources_raw] if sources_raw else [],
                reasoning=reasoning_raw if reasoning_raw else [],
                retrieval_used=msg.get("retrieval_used", False),
                timestamp=msg.get("timestamp", ""),
            ))

        session_list.append(SessionOut(
            id=str(s.get("_id", s["session_id"])),
            session_id=s["session_id"],
            title=s.get("title", "Untitled"),
            messages=messages_out,
            created_at=s.get("created_at", ""),
            updated_at=s.get("updated_at", ""),
            message_count=len(s.get("messages", [])),
        ))

    return SessionListResponse(sessions=session_list, total=len(session_list))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a specific session with all messages."""
    db = get_db()
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a specific chat session."""
    db = get_db()
    result = await db.sessions.delete_one({"session_id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.activity.insert_one({
        "action": "Session deleted",
        "detail": f"Session {session_id[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "session_delete",
    })

    return {"status": "success", "session_id": session_id}
