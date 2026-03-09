#!/bin/sh

set -eu

ENV_FILE="${ENV_FILE:-.env.real}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing env file: $ENV_FILE" >&2
  echo "copy .env.real.example to $ENV_FILE first" >&2
  exit 1
fi

exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
