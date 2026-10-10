# ==========================================
# Stage 1: Build Frontend (React + Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Runtime (FastAPI + Nginx)
# ==========================================
FROM python:3.12-slim AS runtime

# Install system dependencies & Nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy built frontend assets to Nginx web root
COPY --from=frontend-builder /build/dist /var/www/html

# Setup Nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default

# Setup Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Data and cache persistence directories
RUN mkdir -p /app/backend/data /var/cache/nginx/covers && \
    chown -R www-data:www-data /var/cache/nginx

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
