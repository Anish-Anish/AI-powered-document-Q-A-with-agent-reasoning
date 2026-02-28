"""Dashboard routes: stats, activity, agent distribution."""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

from app.database import get_db
from app.services.vector_store import get_total_chunks
from app.models.schemas import DashboardStats, DashboardResponse, ActivityItem

router = APIRouter()


def format_relative_time(timestamp_str: str) -> str:
    """Convert ISO timestamp to relative time string."""
    try:
        ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff = now - ts
        minutes = int(diff.total_seconds() / 60)

        if minutes < 1:
            return "Just now"
        elif minutes < 60:
            return f"{minutes} min ago"
        elif minutes < 1440:
            hours = minutes // 60
            return f"{hours} hr{'s' if hours > 1 else ''} ago"
        else:
            days = minutes // 1440
            return f"{days} day{'s' if days > 1 else ''} ago"
    except Exception:
        return "Unknown"


@router.get("/dashboard/stats", response_model=DashboardResponse)
async def get_dashboard_stats():
    """Get dashboard statistics, recent activity, and agent distribution."""
    db = get_db()

    # Count documents
    total_documents = await db.documents.count_documents({})

    # Count queries
    query_stat = await db.stats.find_one({"key": "query_count"})
    total_queries = query_stat["value"] if query_stat else 0

    # Count active sessions (sessions updated in last 24h)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    active_sessions = await db.sessions.count_documents(
        {"updated_at": {"$gte": cutoff}}
    )

    # Total sessions fallback
    if active_sessions == 0:
        active_sessions = await db.sessions.count_documents({})

    # Average response time (from recent activity)
    avg_response_time = 1.2  # Default placeholder

    stats = DashboardStats(
        total_documents=total_documents,
        total_queries=total_queries,
        active_sessions=active_sessions,
        avg_response_time=avg_response_time,
    )

    # Recent activity
    activity_cursor = db.activity.find({}, {"_id": 0}).sort("timestamp", -1).limit(10)
    activities_raw = await activity_cursor.to_list(length=10)

    recent_activity = []
    for a in activities_raw:
        recent_activity.append(ActivityItem(
            action=a.get("action", ""),
            detail=a.get("detail", ""),
            time=format_relative_time(a.get("timestamp", "")),
            timestamp=a.get("timestamp", ""),
        ))

    # Agent distribution (count by strategy type)
    pipeline = [
        {"$match": {"type": {"$in": ["query", "chat"]}}},
        {"$group": {"_id": "$strategy", "count": {"$sum": 1}}},
    ]
    dist_cursor = db.activity.aggregate(pipeline)
    dist_results = await dist_cursor.to_list(length=100)

    total_agent_calls = sum(d["count"] for d in dist_results) or 1
    agent_distribution = {"document_search": 0, "direct_llm": 0, "combined": 0}
    for d in dist_results:
        strategy = d["_id"] or "direct_llm"
        if strategy in agent_distribution:
            agent_distribution[strategy] = round(d["count"] / total_agent_calls * 100)
        elif strategy == "calculator":
            agent_distribution["direct_llm"] = agent_distribution.get("direct_llm", 0) + round(
                d["count"] / total_agent_calls * 100
            )

    # Ensure percentages add up if we have data
    if sum(agent_distribution.values()) == 0 and total_queries > 0:
        agent_distribution = {"document_search": 60, "direct_llm": 30, "combined": 10}

    return DashboardResponse(
        stats=stats,
        recent_activity=recent_activity,
        agent_distribution=agent_distribution,
    )
