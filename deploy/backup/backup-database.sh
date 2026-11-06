#!/usr/bin/env bash
set -euo pipefail

backup_directory="${BACKUP_DIRECTORY:-/backups}"
retained_dump_count="${RETAINED_DUMP_COUNT:-14}"
dump_path="$backup_directory/kairos-$(date +%F).dump"
partial_path="$dump_path.partial"

export PGHOST="${PGHOST:-database}"
export PGUSER="${PGUSER:-kairos}"
export PGDATABASE="${PGDATABASE:-kairos}"

trap 'rm -f "$partial_path"' EXIT

pg_dump -Fc -f "$partial_path"
mv "$partial_path" "$dump_path"

ls -1r "$backup_directory"/kairos-*.dump | tail -n "+$((retained_dump_count + 1))" | xargs -r rm -f

echo "backup written: $dump_path"
