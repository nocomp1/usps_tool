# ─── Stage 1: compile React ───────────────────────────────────────────────
FROM node:16-alpine AS build-frontend
WORKDIR /usr/src/app

# 1) copy only package manifests & install deps
COPY package.json package-lock.json ./
RUN npm ci --silent

# 2) copy the rest of your React code & build
COPY . .
RUN npm run build

# ─── Stage 2: bundle & run Flask ──────────────────────────────────────────
FROM python:3.10-slim AS runtime
WORKDIR /usr/src/app

# install build tools for any compiled Python deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# 1) install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) copy your Flask app
COPY app.py ./

# 3) drop in the React build into Flask's 'static' dir
COPY --from=build-frontend /usr/src/app/build ./static

# (optional) if you had any other Python modules or .py files:
# COPY your_module.py another_module.py ./  

EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
