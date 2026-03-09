#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DOCKER_SINGLE="${ROOT_DIR}/scripts/docker.sh"

if ! PORT_OUTPUT="$("$DOCKER_SINGLE" port app 3000)"; then
  exit 1
fi

APP_PORT="$(printf '%s\n' "$PORT_OUTPUT" | awk -F: 'END { print $NF }')"

if [ -z "$APP_PORT" ]; then
  echo "failed to resolve app port from docker compose" >&2
  exit 1
fi

echo "app port: $APP_PORT"
"$DOCKER_SINGLE" ps
curl -fsS "http://127.0.0.1:${APP_PORT}/health"
echo
curl -fsS "http://127.0.0.1:${APP_PORT}/debug/state"
