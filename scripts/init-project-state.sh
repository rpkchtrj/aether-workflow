#!/usr/bin/env bash
set -euo pipefail
WORKFLOW_HOME="${ENGINEERING_WORKFLOW_HOME:-$HOME/.engineering-workflow}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "Run inside a Git repository" >&2; exit 1; }
ID="$(${WORKFLOW_HOME}/bin/project-id.sh)"
DEST="$WORKFLOW_HOME/projects/$ID"
mkdir -p "$DEST"/{changes,incidents}
REPO_COPY="$WORKFLOW_HOME/repo"
if [[ -f "$REPO_COPY/templates/CHANGES.md" && ! -f "$DEST/CHANGES.md" ]]; then cp "$REPO_COPY/templates/CHANGES.md" "$DEST/CHANGES.md"; fi
if [[ -f "$REPO_COPY/templates/WORK_LOG.md" && ! -f "$DEST/WORK_LOG.md" ]]; then cp "$REPO_COPY/templates/WORK_LOG.md" "$DEST/WORK_LOG.md"; fi
cat > "$DEST/PROJECT.md" <<EOF
# Private Project Workflow State

Project ID: $ID
Repository root: $ROOT
Created: $(date '+%Y-%m-%d %H:%M:%S')

This directory is private workflow state. It is not part of the repository.
EOF
echo "$DEST"
