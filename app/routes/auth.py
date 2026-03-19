"""Authentication routes — register & login."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from fastapi import Depends

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(body: RegisterBody):
    db = get_db()

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    result = await db.users.insert_one(
        {
            "name": body.name,
            "email": body.email,
            "password": hash_password(body.password),
        }
    )

    user_id = str(result.inserted_id)
    token = create_access_token(user_id, body.email)

    return {
        "token": token,
        "user": {"id": user_id, "name": body.name, "email": body.email},
    }


@router.post("/login")
async def login(body: LoginBody):
    db = get_db()
    user = await db.users.find_one({"email": body.email})

    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token(user_id, body.email)

    return {
        "token": token,
        "user": {"id": user_id, "name": user["name"], "email": user["email"]},
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
    }
