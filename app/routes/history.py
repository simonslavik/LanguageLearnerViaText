"""Translation history routes."""

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])


def _serialize(doc: dict) -> dict:
    """Convert a MongoDB document to JSON-safe dict."""
    doc["id"] = str(doc.pop("_id"))
    doc["user_id"] = str(doc["user_id"])
    return doc


@router.get("")
async def list_history(user=Depends(get_current_user)):
    """Return all translations for the current user (newest first),
    with only metadata (no full text) to keep the response light."""
    db = get_db()
    cursor = db.history.find(
        {"user_id": ObjectId(user["_id"])},
        {
            "filename": 1,
            "target_lang": 1,
            "target_lang_code": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1)

    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "filename": doc.get("filename", ""),
            "target_lang": doc.get("target_lang", ""),
            "target_lang_code": doc.get("target_lang_code", ""),
            "created_at": doc.get("created_at", ""),
        })
    return items


@router.get("/{history_id}")
async def get_history_item(history_id: str, user=Depends(get_current_user)):
    """Return full translation result for a single history entry."""
    db = get_db()
    try:
        oid = ObjectId(history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    doc = await db.history.find_one({"_id": oid, "user_id": ObjectId(user["_id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Translation not found")

    return _serialize(doc)


@router.delete("/{history_id}")
async def delete_history_item(history_id: str, user=Depends(get_current_user)):
    """Delete a single history entry."""
    db = get_db()
    try:
        oid = ObjectId(history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history ID")

    result = await db.history.delete_one({"_id": oid, "user_id": ObjectId(user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Translation not found")

    return {"detail": "Deleted"}


@router.delete("")
async def clear_history(user=Depends(get_current_user)):
    """Delete all history for the current user."""
    db = get_db()
    await db.history.delete_many({"user_id": ObjectId(user["_id"])})
    return {"detail": "History cleared"}
