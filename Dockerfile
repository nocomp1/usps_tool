# ─── Stage 1: build React frontend ────────────────────────────────────────
FROM node:18-alpine AS frontend
WORKDIR /usr/src/app/frontend

# 1) Copy package manifests & install deps
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 2) Copy your source and build
COPY frontend/src ./src
COPY frontend/public ./public
# If you have any environment files in frontend, uncomment:
# COPY frontend/.env* ./

RUN npm run build

# ─── Stage 2: build & bundle Python backend ───────────────────────────────
FROM python:3.10-slim AS backend
WORKDIR /usr/src/app/backend

# Install build tools for compiled Python packages
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# 1) Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) Copy backend code
COPY backend/ ./

# 3) Pull in the React build into Flask's static folder
COPY --from=frontend /usr/src/app/frontend/build ./static

EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
