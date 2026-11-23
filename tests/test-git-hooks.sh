#!/bin/sh
# T5, T10, T11: global git hooks dispatcher (git/hooks)
HOOKS=$(cd "$(dirname "$0")/../git/hooks" 2>/dev/null && pwd) || HOOKS=/nonexistent/git/hooks
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
rc=0
export HOME="$W/home" GIT_CONFIG_GLOBAL="$W/home/gitconfig" GIT_CONFIG_SYSTEM=/dev/null
mkdir -p "$HOME"
: > "$GIT_CONFIG_GLOBAL"

R="$W/repo"
git init -q "$R"
git -C "$R" config user.name t
git -C "$R" config user.email t@example.com
git -C "$R" config commit.gpgsign false
git -C "$R" config core.hooksPath "$HOOKS"

# T10
echo a > "$R/a.txt"; git -C "$R" add a.txt
err=$(git -C "$R" commit -q -m "x" -m "Co-Authored-By: Claude <noreply@anthropic.com>" 2>&1); s=$?
n=$(git -C "$R" rev-list --all --count 2>/dev/null)
if [ "$s" -eq 1 ] && printf %s "$err" | grep -qi 'co-author' && [ "${n:-0}" -eq 0 ]; then
  echo "ok T10 commit with Claude trailer rejected (exit 1, no commit)"
else
  echo "not ok T10 trailer commit: exit=$s commits=$n stderr=$err"; rc=1
fi
out=$(git -C "$R" commit -q -m "y" 2>&1); s=$?
n=$(git -C "$R" rev-list --all --count 2>/dev/null)
if [ "$s" -eq 0 ] && [ "${n:-0}" -eq 1 ]; then echo "ok T10 clean commit succeeds"; else echo "not ok T10 clean commit: exit=$s commits=$n out=$out"; rc=1; fi

# T11
mkdir -p "$R/.git/hooks"
printf '#!/bin/sh\ntouch "$(git rev-parse --show-toplevel)/ran-pre-commit"\n' > "$R/.git/hooks/pre-commit"
chmod +x "$R/.git/hooks/pre-commit"
echo b > "$R/b.txt"; git -C "$R" add b.txt
out=$(git -C "$R" commit -q -m "y" 2>&1); s=$?
if [ "$s" -eq 0 ] && [ -f "$R/ran-pre-commit" ]; then
  echo "ok T11 repo's own .git/hooks/pre-commit still runs and commit succeeds"
else
  echo "not ok T11 chaining: exit=$s marker=$([ -f "$R/ran-pre-commit" ] && echo yes || echo no) out=$out"; rc=1
fi

# T5: a merge runs plugin/bin/codemap-sync, found relative to the hooks dir (copy of the repo's git/hooks and plugin/bin, stub swapped in)
REPO=$(cd "$(dirname "$0")/.." && pwd)
C="$W/copy"
mkdir -p "$C/git" "$C/plugin"
cp -RP "$REPO/git/hooks" "$C/git/hooks" 2>/dev/null
cp -RP "$REPO/plugin/bin" "$C/plugin/bin" 2>/dev/null
printf '#!/bin/sh\ntouch "$(dirname "$0")/ran-codemap-sync"\n' > "$C/plugin/bin/codemap-sync"
chmod +x "$C/plugin/bin/codemap-sync"
M="$W/mrepo"
git init -q -b main "$M"
git -C "$M" config user.name t
git -C "$M" config user.email t@example.com
git -C "$M" config commit.gpgsign false
git -C "$M" config core.hooksPath "$C/git/hooks"
echo a > "$M/a.txt"; git -C "$M" add a.txt; git -C "$M" commit -q -m base
git -C "$M" checkout -q -b feat
echo f > "$M/f.txt"; git -C "$M" add f.txt; git -C "$M" commit -q -m feat
git -C "$M" checkout -q main
echo m > "$M/m.txt"; git -C "$M" add m.txt; git -C "$M" commit -q -m main2
out=$(git -C "$M" merge --no-edit feat 2>&1); s=$?
if [ "$s" -eq 0 ] && [ -f "$C/plugin/bin/ran-codemap-sync" ]; then
  echo "ok T5 merge exits 0 and the dispatcher ran plugin/bin/codemap-sync"
else
  echo "not ok T5 merge: exit=$s marker=$([ -f "$C/plugin/bin/ran-codemap-sync" ] && echo yes || echo no) out=$out"; rc=1
fi

exit "$rc"
