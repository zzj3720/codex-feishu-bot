#!/bin/sh
set -eu

CODEX_HOME_DIR="${CODEX_HOME_DIR:-/root/.codex}"
LISTEN_URL="${CODEX_APP_SERVER_LISTEN_URL:-ws://0.0.0.0:4500}"

mkdir -p "${CODEX_HOME_DIR}"

if [ ! -f "${CODEX_HOME_DIR}/auth.json" ]; then
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf '%s' "${OPENAI_API_KEY}" | codex login --with-api-key
  else
    echo "Missing Codex auth. Mount ${CODEX_HOME_DIR} with auth.json or set OPENAI_API_KEY." >&2
    exit 1
  fi
fi

if [ "$#" -gt 0 ]; then
  exec codex "$@"
fi

exec codex app-server --listen "${LISTEN_URL}"
