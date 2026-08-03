#!/bin/bash
# deploy.sh — Rebuild y redeploy del container smartlex-docai sin cache

set -e

PROJECT_DIR="/root/PoC_Smartlex_DocAI"
APP="app"

cd "$PROJECT_DIR"

echo "=== [deploy.sh] Iniciando deploy $(date) ==="

echo ">>> Deteniendo container..."
docker compose stop $APP

echo ">>> Build sin cache..."
docker compose build --no-cache $APP

echo ">>> Levantando container (force-recreate)..."
docker compose up -d --force-recreate $APP

echo ">>> Esperando que arranque (10s)..."
sleep 10

echo ">>> Estado:"
docker compose ps $APP

echo ">>> Últimos logs:"
docker compose logs --tail=20 $APP

echo "=== [deploy.sh] Deploy completado $(date) ==="
