#!/usr/bin/env bash
# Deprecated. The installer is now the `aether-workflow` npm package:
#
#   npx aether-workflow@latest install
#
# This script is kept so existing clones keep working. It forwards to the
# Node installer in this checkout, which is the same code the package ships.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "install.sh now requires Node.js 18+." >&2
  echo "Install Node, or run: npx aether-workflow@latest install" >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 18 )); then
  echo "Node.js 18+ required (found $(node --version))." >&2
  exit 1
fi

echo "Note: ./install.sh is deprecated. Prefer: npx aether-workflow@latest install" >&2
exec node "$ROOT/bin/aether.js" install "$@"
