#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
check_project="kairos-offsite-check"
offsite_bucket_directory="/data/kairos-offsite-check"

default_services="$(env -u COMPOSE_PROFILES docker compose -f "$repository_root/deploy/compose.yml" --env-file "$repository_root/deploy/env.example" config --services)"
if grep -qx "offsite-backup" <<<"$default_services"; then
  echo "the offsite copy must stay disabled with the example settings" >&2
  exit 1
fi
offsite_services="$(COMPOSE_PROFILES=offsite docker compose -f "$repository_root/deploy/compose.yml" --env-file "$repository_root/deploy/env.example" config --services)"
if grep -qx "offsite-restore" <<<"$offsite_services$default_services"; then
  echo "the offsite restore service must only run on demand" >&2
  exit 1
fi

export COMPOSE_PROFILES=offsite
export KAIROS_OFFSITE_ENDPOINT=http://fake-object-storage:8080
export KAIROS_OFFSITE_REGION=eu-paris-1
export KAIROS_OFFSITE_BUCKET=kairos-offsite-check
export KAIROS_OFFSITE_ACCESS_KEY_ID=offsite-check-access
export KAIROS_OFFSITE_SECRET_ACCESS_KEY=offsite-check-secret

compose=(docker compose -f "$repository_root/deploy/compose.yml" -f "$repository_root/tests/deploy/offsite-check.compose.yml" --env-file "$repository_root/deploy/env.example" -p "$check_project")

tear_down() {
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap tear_down EXIT

"${compose[@]}" up -d --wait database backup fake-object-storage

"${compose[@]}" exec -T backup bash /backup/backup-database.sh
dump_path="$("${compose[@]}" exec -T backup sh -c 'ls -1t /backups/kairos-*.dump | head -n 1' | tr -d '\r')"
dump_name="$(basename "$dump_path")"
local_checksum="$("${compose[@]}" exec -T backup sha256sum "$dump_path" | cut -d ' ' -f 1)"

offsite_names() {
  "${compose[@]}" exec -T fake-object-storage ls -1 "$offsite_bucket_directory" | tr -d '\r'
}

expect_offsite_dump() {
  if ! grep -qx "$1" <<<"$(offsite_names)"; then
    echo "$2: $1 missing from the bucket" >&2
    exit 1
  fi
}

for day in $(seq -w 1 15); do
  "${compose[@]}" exec -T fake-object-storage sh -c "printf old > $offsite_bucket_directory/kairos-2026-01-$day.dump && touch -d '2000-01-01 00:00' $offsite_bucket_directory/kairos-2026-01-$day.dump"
done

"${compose[@]}" run --rm -T --entrypoint sh offsite-backup /backup/copy-backups-offsite.sh

expect_offsite_dump "$dump_name" "offsite copy failed"
expect_offsite_dump "kairos-2026-01-03.dump" "offsite retention failed: an old dump among the 14 newest was deleted"
if grep -qx -e "kairos-2026-01-01.dump" -e "kairos-2026-01-02.dump" <<<"$(offsite_names)"; then
  echo "offsite retention failed: the dumps beyond the 14 newest are still there" >&2
  exit 1
fi
if [ "$(offsite_names | grep -c '^kairos-.*\.dump$')" -ne 14 ]; then
  echo "offsite retention failed: the bucket does not hold exactly the 14 newest dumps" >&2
  exit 1
fi

offsite_checksum="$("${compose[@]}" exec -T fake-object-storage sha256sum "$offsite_bucket_directory/$dump_name" | cut -d ' ' -f 1)"
if [ "$offsite_checksum" != "$local_checksum" ]; then
  echo "offsite copy differs from the local dump" >&2
  exit 1
fi

if "${compose[@]}" run --rm -T --entrypoint sh offsite-backup -c 'touch /backups/write-probe' 2>/dev/null; then
  echo "the offsite copy must see the backups volume read-only" >&2
  exit 1
fi

"${compose[@]}" exec -T backup rm "$dump_path"
"${compose[@]}" exec -T fake-object-storage sh -c "printf older > $offsite_bucket_directory/kairos-2025-12-31.dump"
empty_volume_log="$("${compose[@]}" run --rm -T --entrypoint sh offsite-backup /backup/copy-backups-offsite.sh)"
if ! grep -q "offsite prune skipped" <<<"$empty_volume_log" || [ "$(offsite_names | grep -c '^kairos-.*\.dump$')" -ne 15 ]; then
  echo "offsite retention failed: a run with an empty local volume deleted dumps from the bucket" >&2
  exit 1
fi
expect_offsite_dump "kairos-2025-12-31.dump" "offsite retention failed with an empty local volume"

"${compose[@]}" exec -T backup sh -c "printf stale > /backups/kairos-2025-12-30.dump && touch -d '2000-01-01 00:00' /backups/kairos-2025-12-30.dump"
"${compose[@]}" run --rm -T --entrypoint sh offsite-backup /backup/copy-backups-offsite.sh >/dev/null
if [ "$(offsite_names | grep -c '^kairos-.*\.dump$')" -ne 16 ]; then
  echo "offsite retention failed: a run without a recent local dump deleted dumps from the bucket" >&2
  exit 1
fi
"${compose[@]}" exec -T backup rm /backups/kairos-2025-12-30.dump

"${compose[@]}" run --rm -T offsite-restore lsf offsite:kairos-offsite-check | tr -d '\r' | grep -qx "$dump_name"
"${compose[@]}" run --rm -T offsite-restore copy "offsite:kairos-offsite-check/$dump_name" /backups/
fetched_checksum="$("${compose[@]}" exec -T backup sha256sum "$dump_path" | cut -d ' ' -f 1)"
if [ "$fetched_checksum" != "$local_checksum" ]; then
  echo "fetching the offsite copy back failed" >&2
  exit 1
fi

"${compose[@]}" up -d offsite-backup
for attempt in $(seq 1 30); do
  if "${compose[@]}" logs offsite-backup 2>/dev/null | grep -q "offsite copy done"; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "the offsite service did not copy the backups when it started" >&2
    exit 1
  fi
  sleep 1
done
if [ -z "$("${compose[@]}" ps --status running -q offsite-backup)" ]; then
  echo "the offsite service stopped instead of waiting for the next daily copy" >&2
  exit 1
fi

if KAIROS_OFFSITE_BUCKET="" "${compose[@]}" run --rm -T --entrypoint sh offsite-backup /backup/copy-backups-offsite.sh 2>/dev/null; then
  echo "the offsite copy must refuse to run without its settings" >&2
  exit 1
fi

echo "offsite ok"
