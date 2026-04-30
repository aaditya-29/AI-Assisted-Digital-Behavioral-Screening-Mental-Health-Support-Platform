#!/bin/bash
set -e

echo "Starting backend..."
cd /app/backend

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

echo "Waiting for backend to be ready..."
MAX_RETRIES=10
RETRY_COUNT=0

until curl -s http://127.0.0.1:8000/health > /dev/null; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "Backend failed to start after $MAX_RETRIES attempts."
    exit 1
  fi

  echo "Backend not ready yet... retrying ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "Backend is up!"

echo "Starting nginx..."
exec nginx -g "daemon off;"