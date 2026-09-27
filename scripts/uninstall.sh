#!/usr/bin/env bash
set -euo pipefail
PURGE=0
[[ "${1:-}" == "--purge-state" ]] && PURGE=1
WORKFLOW_HOME="${ENGINEERING_WORKFLOW_HOME:-$HOME/.engineering-workflow}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
for s in engineering-orchestrator requirements-architect system-design-challenger implementation-agent runtime-engineer verification-engineer distributed-adversary chaos-engineer performance-engineer senior-code-reviewer ai-incident-commander security-adversary distributed-tracing-engineer engineering-reasoning-reviewer engineering-guide documentation-guardian; do rm -rf "$CLAUDE_HOME/skills/$s"; done
if [[ -f "$CLAUDE_HOME/CLAUDE.md" ]]; then
  python3 - "$CLAUDE_HOME/CLAUDE.md" "$WORKFLOW_HOME" <<'PYUNINSTALL'
from pathlib import Path
import sys
p=Path(sys.argv[1]); home=sys.argv[2]
lines=p.read_text().splitlines(); out=[]; skipping=False
for line in lines:
    if line.strip()=="# Personal AI-Assisted Engineering Workflow": skipping=True; continue
    if skipping and line.strip()==f"@{home}/GLOBAL_ENGINEERING_CONTRACT.md": continue
    if skipping:
        if line.strip()=="": continue
        skipping=False
    out.append(line)
p.write_text("\n".join(out).rstrip()+"\n")
PYUNINSTALL
fi
rm -rf "$WORKFLOW_HOME/bin" "$WORKFLOW_HOME/hosts/claude" "$WORKFLOW_HOME/repo"
if [[ "$PURGE" == "1" ]]; then rm -rf "$WORKFLOW_HOME/projects" "$WORKFLOW_HOME"; else echo "Private project state preserved under $WORKFLOW_HOME/projects"; fi
echo "Workflow uninstalled."
