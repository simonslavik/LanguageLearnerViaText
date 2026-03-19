"""MongoDB connection and collection accessors."""

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

client: AsyncIOMotorClient = None  # set on startup
db = None


async def connect_db():
    """Create the MongoDB client and set up indexes."""
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB]

    # Ensure unique email index
    await db.users.create_index("email", unique=True)
    # Index history by user for fast lookups
    await db.history.create_index("user_id")
    await db.history.create_index([("user_id", 1), ("created_at", -1)])


async def close_db():
    """Close the MongoDB client."""
    global client
    if client:
        client.close()


def get_db():
    """Return the database instance."""
    return db
