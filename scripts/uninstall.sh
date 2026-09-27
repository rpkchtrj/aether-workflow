#!/usr/bin/env bash
# Deprecated. Prefer: npx aether-workflow@latest uninstall [--purge-state]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/bin/aether.js" ]] && command -v node >/dev/null 2>&1; then
  exec node "$ROOT/bin/aether.js" uninstall "$@"
fi
exec npx --yes aether-workflow@latest uninstall "$@"
