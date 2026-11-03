#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: restore-database.sh <dump path inside the backup container, e.g. /backups/kairos-2026-11-03.dump>" >&2
  exit 2
fi

dump_path="$1"
deploy_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${KAIROS_ENV_FILE:-$deploy_directory/.env}"
compose=(docker compose -f "$deploy_directory/compose.yml" --env-file "$env_file")

app_was_running="$("${compose[@]}" ps --status running -q app)"

"${compose[@]}" exec -T backup test -f "$dump_path"
"${compose[@]}" stop app

if ! "${compose[@]}" exec -T backup pg_restore --clean --if-exists --single-transaction --exit-on-error --no-owner --dbname kairos "$dump_path"; then
  echo "Restauration échouée : l'application reste arrêtée" >&2
  exit 1
fi

if [ -n "$app_was_running" ]; then
  "${compose[@]}" start app
fi

echo "restored: $dump_path"
