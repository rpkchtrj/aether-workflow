#!/usr/bin/env bash
set -euo pipefail
WORKFLOW_HOME="${ENGINEERING_WORKFLOW_HOME:-$HOME/.engineering-workflow}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
expected=(engineering-orchestrator requirements-architect system-design-challenger implementation-agent runtime-engineer verification-engineer distributed-adversary chaos-engineer performance-engineer senior-code-reviewer ai-incident-commander security-adversary distributed-tracing-engineer engineering-reasoning-reviewer engineering-guide documentation-guardian)
fail=0
for s in "${expected[@]}"; do
  f="$CLAUDE_HOME/skills/$s/SKILL.md"
  if [[ ! -f "$f" ]]; then echo "MISSING: $f"; fail=1; continue; fi
  grep -q '^model:' "$f" || { echo "NO MODEL: $f"; fail=1; }
  grep -q '^disable-model-invocation: true' "$f" || { echo "NO INVOCATION GATE: $f"; fail=1; }
done
[[ -f "$WORKFLOW_HOME/GLOBAL_ENGINEERING_CONTRACT.md" ]] || { echo "MISSING global contract"; fail=1; }
[[ -f "$WORKFLOW_HOME/hosts/claude/models.yaml" ]] || { echo "MISSING model mapping"; fail=1; }
if [[ $fail -eq 0 ]]; then echo "Workflow installation looks healthy."; fi
exit $fail
