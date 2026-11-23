#!/usr/bin/env bash
# T9: /aether-wfl:pr passes the title from a file; a hostile title cannot run shell (S2).
# Prints "ok T9 ..." / "not ok T9 ...".
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
SKILL="$REPO/plugin/skills/pr/SKILL.md"
rc=0
ok() { echo "ok $1 $2"; }
nok() { echo "not ok $1 $2"; rc=1; }

W=$(mktemp -d "${TMPDIR:-/tmp}/prtitle.XXXXXX") || exit 1
trap 'rm -rf "$W"' EXIT
export W
mkdir -p "$W/bin" "$W/gd"
GD="$W/gd"

# Stubs: write argv, one per line, to a log named after the tool.
for tool in gh glab; do
  cat >"$W/bin/$tool" <<'STUB'
#!/bin/sh
for a in "$@"; do printf '%s\n' "$a"; done >"$W/$(basename "$0").log"
exit 0
STUB
  chmod +x "$W/bin/$tool"
done

# The hostile title, exactly as it would come from a commit subject.
printf '%s' "x'; touch \"\$W/pwned\"; echo '" >"$GD/wfl-pr-title.txt"
printf 'body text\n' >"$GD/wfl-pr-body.md"

# Extract the two commands from SKILL.md (first backticked command on each bullet).
gh_line=$(grep -F '**github.com:**' "$SKILL" | sed -n 's/.*`\(gh pr create[^`]*\)`.*/\1/p' | head -n 1)
glab_line=$(grep -F 'glab mr create' "$SKILL" | sed -n 's/.*`\(glab mr create[^`]*\)`.*/\1/p' | head -n 1)

fill() {
  printf '%s' "$1" | sed -e "s|<target>|main|g" -e "s|<feat>|feat/x|g" -e "s|<gd>|$GD|g"
}

if [ -z "$gh_line" ] || [ -z "$glab_line" ]; then
  nok T9 "could not extract gh/glab command lines from SKILL.md"
  exit 1
fi

arg_after_title() { # $1 = log file
  awk 'prev == "--title" { print; found = 1; exit } { prev = $0 } END { exit !found }' "$1"
}

want=$(cat "$GD/wfl-pr-title.txt")

for pair in "gh:$gh_line" "glab:$glab_line"; do
  tool=${pair%%:*}
  line=${pair#*:}
  cmd=$(fill "$line")
  rm -f "$W/$tool.log"
  PATH="$W/bin:$PATH" sh -c "$cmd" >/dev/null 2>&1
  if [ ! -f "$W/$tool.log" ]; then
    nok T9 "$tool stub was not invoked by: $cmd"
    continue
  fi
  got=$(arg_after_title "$W/$tool.log")
  if [ "$got" = "$want" ]; then
    ok T9 "$tool: --title argument equals the title file exactly"
  else
    nok T9 "$tool: --title argument '$got' differs from file contents"
  fi
done

if [ -e "$W/pwned" ]; then
  nok T9 "hostile title ran shell (pwned exists)"
else
  ok T9 "hostile title did not run shell"
fi

old="--title '<""title>'"
if grep -qF -e "$old" "$SKILL"; then
  nok T9 "SKILL.md still passes the title on the command line"
else
  ok T9 "SKILL.md has no inline --title argument"
fi

exit "$rc"
