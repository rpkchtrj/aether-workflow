#!/usr/bin/env bash
# SessionStart: one-line notice when .plans/CODEMAP.md is behind HEAD. No LLM cost; refresh stays a user decision.
common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
root=$( [ "$(basename "$common")" = ".git" ] && dirname "$common" || git rev-parse --show-toplevel )
map="$root/.plans/CODEMAP.md"
[ -f "$map" ] || exit 0
sha=$(sed -n 's/^Mapped at: \([0-9a-f]\{7,40\}\).*/\1/p' "$map" | head -1)
[ -n "$sha" ] || exit 0
git cat-file -e "$sha^{commit}" 2>/dev/null || { echo "[codemap] Mapped-at commit $sha not found; suggest /codemap refresh."; exit 0; }
n=$(git diff --name-only "$sha"..HEAD 2>/dev/null \
  | grep -vE '(^|/)(\.plans|docs|test|tests|__tests__|vendor|node_modules|dist|build)/|\.(md|lock)$|_test\.go$|\.(test|spec)\.[jt]sx?$' \
  | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || exit 0
if [ "$(git rev-parse --show-toplevel)" = "$root" ]; then
  echo "[codemap] $n source files changed since the codemap ($sha). Entries for those areas may be stale; suggest /aether-wfl:codemap to the user before relying on them."
else
  echo "[codemap] This worktree differs from the codemap ($sha, main checkout's branch) in $n source files. Read those files instead of trusting their entries; only the main checkout may refresh the map."
fi
exit 0
