#!/usr/bin/env bash
set -euo pipefail

compose_file="deploy/compose.yml"
compose_project="kairos"
app_service="app"
app_image="kairos-app"
previous_tag="previous"
health_attempts=30
health_interval_seconds=2

compose() {
  docker compose --project-name "$compose_project" -f "$compose_file" "$@"
}

read_app_health() {
  local container_id
  container_id="$(compose ps -q "$app_service")"
  if [ -z "$container_id" ]; then
    echo "missing"
    return
  fi
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || echo "missing"
}

wait_until_healthy() {
  local attempt
  for attempt in $(seq 1 "$health_attempts"); do
    if [ "$(read_app_health)" = "healthy" ]; then
      return 0
    fi
    sleep "$health_interval_seconds"
  done
  return 1
}

if [ ! -f "$compose_file" ]; then
  echo "Run this script from the repository root (missing $compose_file)." >&2
  exit 2
fi

has_previous_image=false
if docker image inspect "$app_image:latest" >/dev/null 2>&1; then
  docker tag "$app_image:latest" "$app_image:$previous_tag"
  has_previous_image=true
fi

git fetch origin
git checkout --detach origin/main

compose build "$app_service"
compose up -d --no-deps "$app_service"

if wait_until_healthy; then
  docker image prune -f
  echo "Deployment succeeded."
  exit 0
fi

echo "The new release did not become healthy after $health_attempts checks." >&2
if [ "$has_previous_image" = true ]; then
  docker tag "$app_image:$previous_tag" "$app_image:latest"
  compose up -d --no-deps --no-build "$app_service"
  echo "Rolled back to the previous image." >&2
else
  echo "No previous image to roll back to." >&2
fi
exit 1
