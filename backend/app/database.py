from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Initialize MongoDB connection."""
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    # Create indexes
    await db.documents.create_index("filename")
    await db.documents.create_index("uploaded_at")
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("updated_at")
    await db.activity.create_index("timestamp")


async def close_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()


def get_db():
    """Get database instance."""
    return db
