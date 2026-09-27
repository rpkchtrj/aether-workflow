#!/usr/bin/env bash
# Deprecated. Prefer: npx aether-workflow@latest verify
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/bin/aether.js" ]] && command -v node >/dev/null 2>&1; then
  exec node "$ROOT/bin/aether.js" verify "$@"
fi
exec npx --yes aether-workflow@latest verify "$@"
