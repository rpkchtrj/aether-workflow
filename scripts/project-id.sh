#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "Not inside a Git repository" >&2; exit 1; }
REMOTE="$(git config --get remote.origin.url || true)"
KEY_INPUT="${REMOTE:-$ROOT}"
printf '%s' "$KEY_INPUT" | shasum -a 256 | awk '{print substr($1,1,24)}'
