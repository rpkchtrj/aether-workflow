#!/bin/sh
# T6, T7, T8: the whole install.sh, run with HOME, the global git config and PATH (stub claude) all inside a temp dir.
REPO=$(cd "$(dirname "$0")/.." && pwd)
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
rc=0

mkdir -p "$W/stub"
cat > "$W/stub/claude" <<'EOF'
#!/bin/sh
echo "$*" >> "$CLAUDE_STUB_LOG"
exit 0
EOF
chmod +x "$W/stub/claude"

# setup <name>: fresh temp HOME with settings.json {} and an empty global git config
setup() {
  H="$W/$1"; mkdir -p "$H/.claude"
  echo '{}' > "$H/.claude/settings.json"
  : > "$H/gitconfig"
  : > "$H/claude.log"
}
# runinstall: run install.sh with the temp HOME; never the real one
runinstall() {
  env HOME="$H" GIT_CONFIG_GLOBAL="$H/gitconfig" GIT_CONFIG_SYSTEM=/dev/null \
    CLAUDE_STUB_LOG="$H/claude.log" PATH="$W/stub:$PATH" sh "$REPO/install.sh" 2>&1
}
gget() { env HOME="$H" GIT_CONFIG_GLOBAL="$H/gitconfig" GIT_CONFIG_SYSTEM=/dev/null git config --global --get core.hooksPath; }

if [ ! -f "$REPO/install.sh" ] || ! grep -q '^# >>> git-merge-guard' "$REPO/install.sh"; then
  echo "not ok T6 install.sh missing or has no git-merge-guard block"
  echo "not ok T7 install.sh missing or has no git-merge-guard block"
  echo "not ok T8 install.sh missing or has no git-merge-guard block"
  exit 1
fi

# T6
setup t6
S="$H/.claude/settings.json"; C="$H/.claude/CLAUDE.md"
runinstall > "$W/t6.out" || { echo "not ok T6 install.sh failed: $(cat "$W/t6.out")"; rc=1; }
ok=1
[ "$(readlink "$H/.local/bin/ctx")" = "$REPO/bin/ctx" ] || { ok=0; echo "# ctx link: $(readlink "$H/.local/bin/ctx")"; }
[ "$(gget)" = "$REPO/git/hooks" ] || { ok=0; echo "# hooksPath: $(gget)"; }
[ "$(jq -r '.attribution.commit' "$S")" = "" ] && [ "$(jq -r '.attribution.pr' "$S")" = "" ] &&
  [ "$(jq -r '.attribution|type' "$S")" = object ] || { ok=0; echo "# attribution wrong"; }
jq -e --arg d "$H/Context" '[.permissions.additionalDirectories[] | select(. == $d)] | length == 1' "$S" >/dev/null || { ok=0; echo "# additionalDirectories wrong"; }
for ev in SessionStart Stop; do
  [ "$(jq --arg e "$ev" '[.hooks[$e][]?.hooks[]?.command | select(contains("ctx\" sync --quiet"))] | length' "$S")" = 1 ] || { ok=0; echo "# $ev ctx hook count wrong"; }
done
[ "$(cat "$C" 2>/dev/null)" = "@$REPO/rules/AETHER.md" ] || { ok=0; echo "# CLAUDE.md: $(cat "$C" 2>/dev/null)"; }
grep -qxF "plugin marketplace add $REPO" "$H/claude.log" || { ok=0; echo "# no marketplace add in stub log"; }
grep -qxF "plugin install aether-wfl@aether" "$H/claude.log" || { ok=0; echo "# no plugin install in stub log"; }
ls "$H/.claude"/settings.json.bak.* >/dev/null 2>&1 || { ok=0; echo "# no settings.json.bak.* (S3)"; }
if [ "$ok" = 1 ]; then echo "ok T6 first run sets ctx link, hooksPath, settings, ctx hooks, CLAUDE.md import, plugin registration, backup"; else echo "not ok T6 first run: out=$(cat "$W/t6.out")"; rc=1; fi
cp "$S" "$W/t6.settings"; cp "$C" "$W/t6.claude"
runinstall > "$W/t6.out2" || true
if cmp -s "$S" "$W/t6.settings" && cmp -s "$C" "$W/t6.claude" && [ "$(gget)" = "$REPO/git/hooks" ] &&
   [ "$(jq '.permissions.additionalDirectories|length' "$S")" = 1 ]; then
  echo "ok T6 second run leaves settings.json and CLAUDE.md byte-identical"
else
  echo "not ok T6 second run changed files: out=$(cat "$W/t6.out2")"; rc=1
fi

# T7
setup t7
env HOME="$H" GIT_CONFIG_GLOBAL="$H/gitconfig" git config --global core.hooksPath /elsewhere
out=$(runinstall)
if [ "$(gget)" = /elsewhere ] && printf %s "$out" | grep -q 'core.hooksPath already set'; then
  echo "ok T7 foreign core.hooksPath kept, warning printed"
else
  echo "not ok T7 hooksPath=$(gget) out=$out"; rc=1
fi

# T8
setup t8
printf '# mine\n@%s/rules/AETHER.md\n' "$REPO" > "$H/other.md"
cp "$H/other.md" "$H/other.before"
ln -s "$H/other.md" "$H/.claude/CLAUDE.md"
out=$(runinstall)
if cmp -s "$H/other.md" "$H/other.before" && [ -L "$H/.claude/CLAUDE.md" ]; then
  echo "ok T8 CLAUDE.md symlink and its target left unchanged when the import is present"
else
  echo "not ok T8 other.md changed or link replaced: out=$out"; rc=1
fi

exit "$rc"
