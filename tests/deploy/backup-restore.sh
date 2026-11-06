#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
check_project="kairos-backup-check"
compose=(docker compose -f "$repository_root/deploy/compose.yml" --env-file "$repository_root/deploy/env.example" -p "$check_project")

tear_down() {
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap tear_down EXIT

"${compose[@]}" up -d --wait database backup

run_sql() {
  "${compose[@]}" exec -T database psql -U kairos -d kairos -tA -c "$1"
}

run_sql "create table backup_check (label text not null)" >/dev/null
run_sql "insert into backup_check values ('kept-by-backup')" >/dev/null

"${compose[@]}" exec -T backup bash /backup/backup-database.sh
dump_path="$("${compose[@]}" exec -T backup sh -c 'ls -1t /backups/kairos-*.dump | head -n 1' | tr -d '\r')"
test -n "$dump_path"

"${compose[@]}" exec -T backup cp "$dump_path" /backups/kairos-2000-01-01.dump
"${compose[@]}" exec -T -e RETAINED_DUMP_COUNT=1 backup bash /backup/backup-database.sh
retained_dumps="$("${compose[@]}" exec -T backup sh -c 'ls -1 /backups/kairos-*.dump' | tr -d '\r')"
if [ "$retained_dumps" != "$dump_path" ]; then
  echo "retention failed: expected only $dump_path, got '$retained_dumps'" >&2
  exit 1
fi

run_sql "drop table backup_check" >/dev/null

COMPOSE_PROJECT_NAME="$check_project" KAIROS_ENV_FILE="$repository_root/deploy/env.example" \
  bash "$repository_root/deploy/backup/restore-database.sh" "$dump_path"

restored_label="$(run_sql "select label from backup_check")"
if [ "$restored_label" != "kept-by-backup" ]; then
  echo "restore failed: got '$restored_label'" >&2
  exit 1
fi

"${compose[@]}" exec -T backup sh -c 'head -c 200 /dev/urandom > /backups/kairos-corrupt.dump'
run_sql "insert into backup_check values ('written-after-restore')" >/dev/null

if COMPOSE_PROJECT_NAME="$check_project" KAIROS_ENV_FILE="$repository_root/deploy/env.example" \
  bash "$repository_root/deploy/backup/restore-database.sh" /backups/kairos-corrupt.dump; then
  echo "a corrupt dump must make the restore fail" >&2
  exit 1
fi

surviving_labels="$(run_sql "select string_agg(label, ',' order by label) from backup_check")"
if [ "$surviving_labels" != "kept-by-backup,written-after-restore" ]; then
  echo "corrupt restore damaged the data: got '$surviving_labels'" >&2
  exit 1
fi

echo "restore ok"
