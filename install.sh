#!/bin/sh
# Install the aether workflow's dependencies: the ctx link, global git hooks, Claude settings, the CLAUDE.md import
# and the aether-wfl plugin. Backs up before changing a file and prints one line per change. Safe to re-run.
set -e
D=$(cd "$(dirname "$0")" && pwd)

link() { # link <repo file> <target>
  if [ -L "$2" ] && [ "$(readlink "$2")" = "$D/$1" ]; then return 0; fi
  mkdir -p "$(dirname "$2")"
  if [ -e "$2" ] && [ ! -L "$2" ]; then mv "$2" "$2.bak.$(date +%Y%m%d%H%M%S)"; echo "backed up $2"; fi
  ln -sfn "$D/$1" "$2" && echo "linked $2"
}

link bin/ctx "$HOME/.local/bin/ctx"

SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

# >>> git-merge-guard
# Claude is never a co-author: attribution.commit/.pr = "" (not `false`, which Claude Code < 2.1.281 rejects, skipping the file);
# ~/Context readable from every project; global git hooks (git/hooks) reject a Claude co-author trailer
if command -v jq >/dev/null && ! jq -e --arg d "$HOME/Context" \
  '.attribution.commit == "" and .attribution.pr == "" and ((.permissions.additionalDirectories // []) | index($d) != null)' \
  "$SETTINGS" >/dev/null 2>&1; then
  cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
  tmp=$(mktemp)
  jq --arg d "$HOME/Context" '.attribution.commit = "" | .attribution.pr = ""
    | .permissions.additionalDirectories = ((.permissions.additionalDirectories // []) | if index($d) then . else . + [$d] end)' \
    "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS" && echo "set attribution and ~/Context in $SETTINGS"
fi
HP=$(git config --global --get core.hooksPath 2>/dev/null || true)
if [ -z "$HP" ]; then
  git config --global core.hooksPath "$D/git/hooks" && echo "set global core.hooksPath to $D/git/hooks"
elif [ "$HP" != "$D/git/hooks" ]; then
  echo "core.hooksPath already set to $HP; leaving it (the git co-author hook is not active globally)"
fi
# <<< git-merge-guard

# ctx sync on SessionStart and Stop: each event gets one hook, added only when none of its hooks already runs ctx sync
if command -v jq >/dev/null; then
  if ! jq -e '([.hooks.SessionStart // [] | .[]?.hooks[]?.command // empty | select(contains("ctx\" sync --quiet"))] | length > 0) and
              ([.hooks.Stop // [] | .[]?.hooks[]?.command // empty | select(contains("ctx\" sync --quiet"))] | length > 0)' \
       "$SETTINGS" >/dev/null 2>&1; then
    cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
    tmp=$(mktemp)
    jq 'def has_ctx: [.[]?.hooks[]?.command // empty | select(contains("ctx\" sync --quiet"))] | length > 0;
      def entry: {"hooks": [{"type": "command", "command": "\"$HOME/.local/bin/ctx\" sync --quiet || true", "timeout": 30}]};
      .hooks.SessionStart = ((.hooks.SessionStart // []) | if has_ctx then . else . + [entry] end)
      | .hooks.Stop = ((.hooks.Stop // []) | if has_ctx then . else . + [entry] end)' \
      "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS" && echo "added ctx sync hooks to $SETTINGS"
  fi
else
  echo "jq not found; settings.json was not changed (install jq and re-run)"
fi

# CLAUDE.md imports the workflow rules. Append through any symlink; never replace the file.
CM="$HOME/.claude/CLAUDE.md"
IMPORT="@$D/rules/AETHER.md"
if ! grep -qxF "$IMPORT" "$CM" 2>/dev/null; then
  if [ -s "$CM" ] && [ -n "$(tail -c1 "$CM")" ]; then echo >> "$CM"; fi
  printf '%s\n' "$IMPORT" >> "$CM" && echo "added $IMPORT to $CM"
fi

# The aether-wfl plugin, loaded in place from this clone
if command -v claude >/dev/null; then
  claude plugin marketplace list 2>/dev/null | grep -q 'aether' ||
    { claude plugin marketplace add "$D" >/dev/null && echo "marketplace aether registered"; }
  claude plugin list 2>/dev/null | grep -q 'aether-wfl@aether' ||
    { claude plugin install aether-wfl@aether >/dev/null && echo "plugin aether-wfl@aether installed"; }
else
  echo "claude CLI not found; later run: claude plugin marketplace add \"$D\" && claude plugin install aether-wfl@aether"
fi
