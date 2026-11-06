#!/bin/sh
set -eu

backup_directory="${BACKUP_DIRECTORY:-/backups}"
offsite_retained_dump_count="${OFFSITE_RETAINED_DUMP_COUNT:-14}"
fresh_local_dump_days="${OFFSITE_FRESH_LOCAL_DUMP_DAYS:-2}"
missing_settings=""

require_setting() {
  if [ -z "$1" ]; then
    missing_settings="$missing_settings $2"
  fi
}

require_setting "${KAIROS_OFFSITE_BUCKET:-}" KAIROS_OFFSITE_BUCKET
require_setting "${RCLONE_CONFIG_OFFSITE_ENDPOINT:-}" KAIROS_OFFSITE_ENDPOINT
require_setting "${RCLONE_CONFIG_OFFSITE_REGION:-}" KAIROS_OFFSITE_REGION
require_setting "${RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID:-}" KAIROS_OFFSITE_ACCESS_KEY_ID
require_setting "${RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY:-}" KAIROS_OFFSITE_SECRET_ACCESS_KEY

if [ -n "$missing_settings" ]; then
  echo "Copie hors machine impossible, à renseigner dans deploy/.env :$missing_settings" >&2
  exit 1
fi

offsite_bucket="offsite:$KAIROS_OFFSITE_BUCKET"

rclone copy "$backup_directory" "$offsite_bucket" --include "kairos-*.dump"

fresh_local_dump="$(find "$backup_directory" -maxdepth 1 -name 'kairos-*.dump' -mtime "-$fresh_local_dump_days" | head -n 1)"
if [ -z "$fresh_local_dump" ]; then
  echo "offsite prune skipped: no local dump younger than $fresh_local_dump_days days in $backup_directory"
else
  expired_dump_list="$(mktemp)"
  trap 'rm -f "$expired_dump_list"' EXIT
  rclone lsf "$offsite_bucket" --files-only --include "kairos-*.dump" \
    | sort -r \
    | tail -n "+$((offsite_retained_dump_count + 1))" > "$expired_dump_list"
  if [ -s "$expired_dump_list" ]; then
    rclone delete "$offsite_bucket" --files-from "$expired_dump_list"
  fi
fi

echo "offsite copy done: $offsite_bucket"
