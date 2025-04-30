# ─── Stage 1: build React frontend ────────────────────────────────────────
FROM node:16-alpine AS frontend
WORKDIR /usr/src/app/frontend

# 1. Copy just package manifests and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 2. Copy source and build
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: build Python backend ───────────────────────────────────────
FROM python:3.10-slim AS backend
WORKDIR /usr/src/app/backend

# Install build tools for any pip packages that need compiling
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# 1. Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy backend source
COPY backend/ ./

# 3. Copy React output into Flask's static folder
COPY --from=frontend /usr/src/app/frontend/build /usr/src/app/backend/static

EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
