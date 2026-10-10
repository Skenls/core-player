#!/bin/sh
set -e

echo "=== Starting Core Player ==="

# Ensure data directory exists
mkdir -p /app/backend/data

# Start FastAPI backend with Uvicorn
echo "Starting FastAPI backend..."
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Start Nginx
echo "Starting Nginx frontend server on port 3000..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Handle graceful shutdown signals
trap "kill -TERM $BACKEND_PID $NGINX_PID 2>/dev/null" SIGINT SIGTERM

# Wait for any process to exit
wait $BACKEND_PID $NGINX_PID
