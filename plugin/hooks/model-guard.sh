#!/usr/bin/env bash
# PreToolUse guard for Agent/Task: never run subagents on Haiku or Fable.
# Denies an explicit haiku/fable model, and an omitted model for agents whose
# definition defaults to haiku/fable, so the caller retries with sonnet or opus.
set -euo pipefail

input=$(cat)
model=$(jq -r '.tool_input.model // empty' <<<"$input" | tr '[:upper:]' '[:lower:]')
type=$(jq -r '.tool_input.subagent_type // empty' <<<"$input")

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$model" in
  *haiku*|*fable*) deny "Haiku and Fable are not allowed. Retry with model: \"sonnet\" (lookups, edits, implementing an approved plan) or \"opus\" (planning, security, review, hard debugging)." ;;
  "") ;;
  *) exit 0 ;;
esac

# Model omitted: the agent's own default applies. Built-ins known to default to Haiku:
case "$type" in
  Explore|claude-code-guide) deny "$type defaults to Haiku. Retry with model: \"sonnet\"." ;;
esac

# Custom and plugin agents: check the definition's frontmatter.
[ -z "$type" ] && exit 0
name=${type##*:}
for f in "$HOME"/.claude/agents/"$name".md "$HOME"/.claude/plugins/cache/*/*/*/agents/"$name".md ./.claude/agents/"$name".md; do
  [ -f "$f" ] || continue
  if sed -n '1,/^---$/{/^---$/!p;}' "$f" | sed -n '1,20p' | grep -qiE '^model:[[:space:]]*(haiku|fable|claude-haiku|claude-fable)'; then
    deny "$type defaults to a disallowed model. Retry with model: \"sonnet\"."
  fi
done
exit 0
