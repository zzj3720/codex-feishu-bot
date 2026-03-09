#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
PORT="${CHROME_DEBUG_PORT:-9222}"
PROFILE_DIR="${CHROME_USER_DATA_DIR:-${ROOT_DIR}/.codex-local/chrome-profile}"
VERSION_URL="http://127.0.0.1:${PORT}/json/version"

mkdir -p "${PROFILE_DIR}"

if curl -fsS "${VERSION_URL}" >/dev/null 2>&1; then
  echo "Chrome CDP already available at ${VERSION_URL}"
  echo "Use this endpoint from Codex or agent-browser."
  exit 0
fi

start_macos() {
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args \
      --remote-debugging-port="${PORT}" \
      --user-data-dir="${PROFILE_DIR}" \
      --no-first-run \
      --no-default-browser-check \
      about:blank
    return 0
  fi

  return 1
}

start_linux() {
  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome \
      --remote-debugging-port="${PORT}" \
      --user-data-dir="${PROFILE_DIR}" \
      --no-first-run \
      --no-default-browser-check \
      about:blank >/dev/null 2>&1 &
    return 0
  fi

  if command -v chromium >/dev/null 2>&1; then
    chromium \
      --remote-debugging-port="${PORT}" \
      --user-data-dir="${PROFILE_DIR}" \
      --no-first-run \
      --no-default-browser-check \
      about:blank >/dev/null 2>&1 &
    return 0
  fi

  return 1
}

case "$(uname -s)" in
  Darwin)
    if ! start_macos; then
      echo "Google Chrome.app not found under /Applications" >&2
      exit 1
    fi
    ;;
  Linux)
    if ! start_linux; then
      echo "google-chrome/chromium not found in PATH" >&2
      exit 1
    fi
    ;;
  *)
    echo "unsupported platform: $(uname -s)" >&2
    exit 1
    ;;
esac

READY=0
for _ in $(seq 1 60); do
  if curl -fsS "${VERSION_URL}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done

if [ "${READY}" -ne 1 ]; then
  echo "Chrome did not expose CDP on port ${PORT}" >&2
  exit 1
fi

echo "Chrome CDP ready: ${VERSION_URL}"
echo "Profile dir: ${PROFILE_DIR}"
echo "Example:"
echo "  agent-browser --cdp ${PORT} open https://open.feishu.cn/app"
