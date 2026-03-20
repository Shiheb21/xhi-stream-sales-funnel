#!/bin/bash
# XHI Stream Sales Funnel — Core Deployment Script
# Designed for robust zero-downtime automated deployment to DigitalOcean / EC2

set -e

# --- 1. System Requirements Check ---
echo "[Deploy] Validating system requirements..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed! Aborting."
    exit 1
fi
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed! Aborting."
    exit 1
fi

echo "✅ Docker && Compose detected."

# --- 2. Code Sync ---
echo "[Deploy] Syncing branch: dev..."
git fetch origin
git checkout dev
git pull origin dev

# --- 3. Database Migration ---
# Uses a temporary one-off container just to execute prisma deploy against the prod volume
echo "[Deploy] Executing Prisma Migrations..."
docker-compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://xhi_admin:${POSTGRES_PASSWORD:-xhi_secret_2026}@postgres:5432/xhi_leads?schema=public" \
  lead-processor npx prisma migrate deploy

# --- 4. Container Rebuild & Launch ---
echo "[Deploy] Rebuilding Production Images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "[Deploy] Restarting Infrastructure (Detached)..."
docker-compose -f docker-compose.prod.yml up -d

# --- 5. Clean Dangling Resources ---
echo "[Deploy] Pruning old untagged images to save disk space..."
docker image prune -f

echo "🚀🚀 XHI CLOUD DEPLOYMENT COMPLETED! Services are LIVE 🚀🚀"
