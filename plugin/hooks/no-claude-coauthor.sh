#!/usr/bin/env bash
# PreToolUse guard for Bash: deny git commit/merge, gh pr create/edit and glab mr create/update
# whose message (inline, or in a file given by -F/--file/--body-file/--description-file, or read
# with $(cat <path>) inside -m/--description)
# adds Claude as co-author or carries a "Generated with Claude Code" footer.
set -euo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
[ -z "$cmd" ] && exit 0

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

sp='[[:space:]]'
# git global options may precede the subcommand: -C <dir>, -c k=v, --no-pager, ...; git may be a path
arg="(\"[^\"]*\"|'[^']*'|[^[:space:]]+)"
guarded="(^|[;&|(\`/]|$sp)(git$sp+(-[Cc]$sp+$arg$sp+|-[^[:space:]]+$sp+)*(commit|merge)|gh$sp+pr$sp+(create|edit)|glab$sp+mr$sp+(create|update))($sp|\$)"
[[ $cmd =~ $guarded ]] || exit 0

# Claude as co-author, or the Claude Code footer
bad='co-authored-by:.*(claude|noreply@anthropic\.com)|generated with.*claude code'
reason="Claude must not be a co-author or footer in commits, merges, PRs or MRs. Remove the Co-Authored-By: Claude trailer / Generated with Claude Code line and retry."

grep -qiE "$bad" <<<"$cmd" && deny "$reason"

# Message files named on the command line (relative paths resolve against git -C <dir>, else cwd)
read -r -d '' -a toks <<<"$cmd" || true
want=0; wantC=0; cdir=""
abspath() { # relative paths resolve against git -C <dir> (itself relative to cwd), else cwd
  case "$1" in /*) printf '%s' "$1"; return ;; esac
  local b=$cwd
  if [ -n "$cdir" ]; then case "$cdir" in /*) b=$cdir ;; *) b="$cwd/$cdir" ;; esac; fi
  printf '%s/%s' "$b" "$1"
}
for t in "${toks[@]}"; do
  t=${t//[\"\']/}
  if [ "$wantC" = 1 ]; then cdir=$t; wantC=0; continue; fi
  [ "$t" = "-C" ] && [ -z "$cdir" ] && { wantC=1; continue; }
  f=""
  if [ "$want" = 1 ]; then f=$t; want=0
  else
    case "$t" in
      -F|--file|--body-file|--description-file) want=1 ;;
      --file=*|--body-file=*|--description-file=*) f=${t#*=} ;;
      -F?*) f=${t#-F} ;;
    esac
  fi
  [ -n "$f" ] || continue
  [ "$f" = "-" ] && continue
  f=$(abspath "$f")
  [ -f "$f" ] || continue
  grep -qiE "$bad" "$f" && deny "$reason (found in $t file)"
done

# $(cat <path>) or $(cat "<path>") inside the command: read that file too
rest=$cmd
catre="\\$\\(cat$sp+(\"[^\"]+\"|'[^']+'|[^[:space:])\"']+)\\)"
while [[ $rest =~ $catre ]]; do
  f=${BASH_REMATCH[1]}
  rest=${rest#*"${BASH_REMATCH[0]}"}
  f=${f//[\"\']/}
  f=$(abspath "$f")
  [ -f "$f" ] || continue
  grep -qiE "$bad" "$f" && deny "$reason (found in cat file)"
done
exit 0
