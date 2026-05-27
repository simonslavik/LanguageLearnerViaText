"""FastAPI application — entry point."""

import os
import sys

# Ensure the project root is on sys.path so `app` is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import connect_db, close_db
from app.limiter import limiter
from app.routes.api import router as api_router
from app.routes.auth import router as auth_router
from app.routes.history import router as history_router

# Ensure the upload folder exists
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="PDF Translator",
    description="Upload a PDF and get an instant side-by-side translation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/health", tags=["ops"])
async def health_check():
    """Simple liveness probe used by Docker healthcheck and monitoring."""
    return {"status": "ok"}


# CORS — restrict to configured origins
_allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)

# API routes
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(history_router)

# Serve React production build for all non-API routes
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

if os.path.isdir(DIST_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    _DIST_ROOT = os.path.realpath(DIST_DIR)

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Serve the React SPA for any non-API route.

        The requested path is resolved and confirmed to stay within the build
        directory before being served, to prevent path-traversal escapes.
        """
        if full_path:
            resolved = os.path.realpath(os.path.join(_DIST_ROOT, full_path))
            if (
                (resolved == _DIST_ROOT or resolved.startswith(_DIST_ROOT + os.sep))
                and os.path.isfile(resolved)
            ):
                return FileResponse(resolved)
        return FileResponse(os.path.join(_DIST_ROOT, "index.html"))


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=True)
