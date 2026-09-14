#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
ENV_FILE=".env.production"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml)

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (copy infra/.env.production.example and add secrets)." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null
set -a
source "$ENV_FILE"
set +a

git pull --ff-only origin master
"${COMPOSE[@]}" config >/dev/null
"${COMPOSE[@]}" build --pull
"${COMPOSE[@]}" up -d postgres redis
"${COMPOSE[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/001-init.sql
"${COMPOSE[@]}" up -d backend frontend nginx

for attempt in {1..30}; do
  if curl --fail --silent --show-error "https://${PUBLIC_DOMAIN}/health" >/dev/null; then
    echo "Deployment healthy: https://${PUBLIC_DOMAIN}"
    exit 0
  fi
  sleep 5
done
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=100 backend nginx
exit 1
