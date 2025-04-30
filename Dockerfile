# ─── Stage 1: build React frontend ────────────────────────────────────────
FROM node:16 AS frontend
WORKDIR /usr/src/app/frontend

# Copy manifest + lock, install cleanly
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy all source and build
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: build Python backend ────────────────────────────────────────
FROM python:3.10-slim AS backend
WORKDIR /usr/src/app/backend

RUN apt-get update \
 && apt-get install -y build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# copy the React build into Flask's static folder
COPY --from=frontend /usr/src/app/frontend/build /usr/src/app/backend/static

EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--chdir", "."]
