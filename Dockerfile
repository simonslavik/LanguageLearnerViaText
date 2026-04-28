# ── Backend — FastAPI / Uvicorn (multi-stage build) ─────────────────────────

# Stage 1: build dependencies in an isolated venv
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a venv so only it needs to be copied to the runtime image
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: lean runtime image
FROM python:3.11-slim

WORKDIR /app

# Copy only the built venv from the builder (no gcc / build tools in prod)
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application source
COPY app/ ./app/

# Uploads directory (mounted as a volume in production)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
