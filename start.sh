#!/bin/bash
set -e

echo "Starting backend..."
cd /app/backend

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

echo "Starting nginx..."
exec nginx -g "daemon off;"