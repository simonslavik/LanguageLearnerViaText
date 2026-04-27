# ── Backend — FastAPI / Uvicorn ──────────────────────────────────────────────
FROM python:3.11-slim

# Install OS-level dependencies needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Uploads directory (mounted as a volume in production)
RUN mkdir -p uploads

EXPOSE 5000

# Run with Uvicorn; workers can be tuned via the WEB_CONCURRENCY env var
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
