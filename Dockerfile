# Multi-stage Dockerfile building frontend (Vite) and backend (FastAPI)

### Stage 1: build the frontend
FROM node:20 AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
COPY frontend/ ./
RUN npm ci --silent --no-audit --prefer-offline
RUN npm run build

### Stage 2: runtime image with Python + nginx
FROM python:3.12-slim-bullseye AS final

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (nginx + minimal build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    build-essential \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend sources and requirements
COPY backend/ ./backend
COPY backend/requirements.txt ./backend/requirements.txt

# Install Python dependencies
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r backend/requirements.txt

# Copy frontend build into nginx webroot
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Configure nginx: serve SPA and proxy /api to the backend (uvicorn)
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINXCONF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }
}
NGINXCONF

# Start script: run backend (uvicorn) and nginx. Nginx runs in foreground.
RUN cat > /start.sh <<'SH'
#!/bin/bash
set -e
# Start backend using uvicorn bound to localhost
cd /app/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
# Start nginx in foreground
nginx -g 'daemon off;'
SH
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
