#!/bin/bash
set -e

echo "=== Starting Core Player ==="

# Ensure data directory exists
mkdir -p /app/backend/data

# Ensure secret and encryption keys exist (generate if not provided in .env)
if [ -z "$SECRET_KEY" ]; then
    echo "SECRET_KEY not set, generating random key..."
    export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "ENCRYPTION_KEY not set, generating Fernet key..."
    export ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
fi

# Configure Nginx Navidrome upstream for accelerated X-Accel-Redirect streaming
ND_URL="${NAVIDROME_URL:-http://127.0.0.1:4533}"
ND_URL="${ND_URL%/}"
echo "Configuring Nginx Navidrome upstream: ${ND_URL}/ (mode: ${NAVIDROME_NETWORK_MODE:-local})"
if [ -f /etc/nginx/conf.d/default.conf ]; then
    sed -i "s|__NAVIDROME_URL__|${ND_URL}|g" /etc/nginx/conf.d/default.conf
fi

# Start FastAPI backend with Uvicorn
echo "Starting FastAPI backend on 127.0.0.1:8000..."
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Start Nginx in foreground
echo "Starting Nginx frontend server on port 3000..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Trap signals without SIG prefix (compatible with all POSIX/Bash shells)
trap 'echo "Stopping processes..."; kill -TERM "$BACKEND_PID" "$NGINX_PID" 2>/dev/null; exit 0' INT TERM

# Wait for any process to exit
wait -n "$BACKEND_PID" "$NGINX_PID"
