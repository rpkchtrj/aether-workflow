#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_HOME="${ENGINEERING_WORKFLOW_HOME:-$HOME/.engineering-workflow}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
SKILLS_HOME="$CLAUDE_HOME/skills"
MODELS_FILE="$ROOT/hosts/claude/models.yaml"
mkdir -p "$WORKFLOW_HOME" "$WORKFLOW_HOME/bin" "$WORKFLOW_HOME/hosts/claude" "$WORKFLOW_HOME/projects" "$SKILLS_HOME" "$CLAUDE_HOME"
rm -rf "$WORKFLOW_HOME/repo"
mkdir -p "$WORKFLOW_HOME/repo"
cp -a "$ROOT/." "$WORKFLOW_HOME/repo/"
cp "$MODELS_FILE" "$WORKFLOW_HOME/hosts/claude/models.yaml"
cp "$ROOT/GLOBAL_ENGINEERING_CONTRACT.md" "$WORKFLOW_HOME/GLOBAL_ENGINEERING_CONTRACT.md"
strategic_model="$(awk -F': *' '$1=="strategic"{print $2}' "$MODELS_FILE")"
implementation_model="$(awk -F': *' '$1=="implementation"{print $2}' "$MODELS_FILE")"
for skill_dir in "$ROOT"/skills/*; do
  name="$(basename "$skill_dir")"; src="$skill_dir/SKILL.md"; dest_dir="$SKILLS_HOME/$name"; dest="$dest_dir/SKILL.md"
  mkdir -p "$dest_dir"; cp "$src" "$dest"
  profile="$(awk '/^  workflow_model_profile:/{print $2}' "$src" | head -1)"
  case "$profile" in strategic) model="$strategic_model";; implementation) model="$implementation_model";; *) model="inherit";; esac
  python3 - "$dest" "$model" <<'PYINSTALL'
from pathlib import Path
import sys, re
p=Path(sys.argv[1]); model=sys.argv[2]
t=p.read_text()
if t.startswith('---\n'):
    _, fm, body=t.split('---\n',2)
    fm=re.sub(r'^model:.*\n','',fm,flags=re.M)
    fm=re.sub(r'^disable-model-invocation:.*\n','',fm,flags=re.M)
    fm=f"model: {model}\ndisable-model-invocation: true\n"+fm
    p.write_text('---\n'+fm+'---\n'+body)
PYINSTALL
done
GLOBAL="$CLAUDE_HOME/CLAUDE.md"
IMPORT_BLOCK=$'\n# Personal AI-Assisted Engineering Workflow\n'
IMPORT_BLOCK+="@${WORKFLOW_HOME}/GLOBAL_ENGINEERING_CONTRACT.md"
IMPORT_BLOCK+=$'\n'
if [[ -f "$GLOBAL" ]]; then cp "$GLOBAL" "$GLOBAL.bak.$(date +%Y%m%d%H%M%S)"; else : > "$GLOBAL"; fi
if ! grep -Fq "Personal AI-Assisted Engineering Workflow" "$GLOBAL"; then printf "%s\n" "$IMPORT_BLOCK" >> "$GLOBAL"; fi
cp "$ROOT/scripts/project-id.sh" "$WORKFLOW_HOME/bin/project-id.sh"
cp "$ROOT/scripts/init-project-state.sh" "$WORKFLOW_HOME/bin/init-project-state.sh"
chmod +x "$WORKFLOW_HOME/bin/project-id.sh" "$WORKFLOW_HOME/bin/init-project-state.sh"
printf 'Installed personal AI-assisted engineering workflow.\nSkills: %s\nWorkflow home: %s\nStrategic model: %s\nImplementation model: %s\n' "$SKILLS_HOME" "$WORKFLOW_HOME" "$strategic_model" "$implementation_model"
printf 'Start a new Claude Code session, then run /engineering-guide status.\n'
