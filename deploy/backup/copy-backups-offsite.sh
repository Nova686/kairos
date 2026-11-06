#!/bin/sh
set -eu

backup_directory="${BACKUP_DIRECTORY:-/backups}"
offsite_retention_days="${OFFSITE_RETENTION_DAYS:-14}"
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
rclone delete "$offsite_bucket" --include "kairos-*.dump" --min-age "${offsite_retention_days}d"

echo "offsite copy done: $offsite_bucket"
