# ─── Stage 1: build React frontend ────────────────────────────────────────
FROM node:16-alpine AS frontend
WORKDIR /usr/src/app/frontend

# 1) Copy just your manifests and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 2) Copy only the actual source files (avoid host node_modules!)
COPY frontend/src ./src
COPY frontend/public ./public
# if you have other build files (e.g. tsconfig.json, env files), list them here:
COPY frontend/tsconfig.json frontend/jsconfig.json ./
COPY frontend/.env* ./

# 3) Produce the static build
RUN npm run build

# ─── Stage 2: build & bundle Python backend ───────────────────────────────
FROM python:3.10-slim AS backend
WORKDIR /usr/src/app/backend

# install system build tools for any compiled Python deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# 1) Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) Your backend code
COPY backend/ ./

# 3) Drop in the React build under Flask’s static folder
COPY --from=frontend /usr/src/app/frontend/build ./static

EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
