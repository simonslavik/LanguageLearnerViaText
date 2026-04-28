import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Settings:
    """Application settings loaded from environment variables."""

    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    UPLOAD_FOLDER: str = os.path.join(BASE_DIR, "uploads")
    MAX_UPLOAD_MB: int = 16
    ALLOWED_EXTENSIONS: set[str] = {"pdf"}

    # MongoDB
    MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "translation_app")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", SECRET_KEY)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))  # 1h default

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # CORS — comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    )


import logging as _logging
_log = _logging.getLogger(__name__)

settings = Settings()

_INSECURE_DEFAULTS = {"dev-secret-key-change-in-production", ""}
if settings.SECRET_KEY in _INSECURE_DEFAULTS or settings.JWT_SECRET in _INSECURE_DEFAULTS:
    _log.warning(
        "WARNING: SECRET_KEY / JWT_SECRET is using an insecure default. "
        "Set strong secrets in the environment before deploying to production."
    )
