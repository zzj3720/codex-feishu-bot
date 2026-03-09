#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.real}"
ENV_EXAMPLE="${ROOT_DIR}/.env.real.example"
STATE_DIR="${ROOT_DIR}/.codex-local"

if [ ! -f "${ENV_EXAMPLE}" ]; then
  echo "missing env example: ${ENV_EXAMPLE}" >&2
  exit 1
fi

mkdir -p "${STATE_DIR}/chrome-profile" "${STATE_DIR}/logs" "${STATE_DIR}/workspace/artifacts"

if [ ! -f "${ENV_FILE}" ]; then
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "created ${ENV_FILE} from ${ENV_EXAMPLE}"
else
  echo "kept existing ${ENV_FILE}"
fi

echo
echo "Next steps:"
echo "  1. Run pnpm chrome:debug"
echo "  2. Let Codex configure Feishu Open Platform and write FEISHU_APP_ID / FEISHU_APP_SECRET into .env.real"
echo "  3. Run pnpm docker:up"
echo "  4. Run pnpm docker:smoke"
