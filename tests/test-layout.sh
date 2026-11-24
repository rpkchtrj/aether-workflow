#!/usr/bin/env bash
# T1, T2, T3, T11: repo layout checks. Prints "ok <ID> ..." / "not ok <ID> ...".
# Patterns are assembled from pieces so this file never matches its own scans.
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
cd "$REPO" || exit 1
rc=0
ok() { echo "ok $1 $2"; }
nok() { echo "not ok $1 $2"; rc=1; }

# T1: marketplace and plugin manifests
mp=.claude-plugin/marketplace.json
pj=plugin/.claude-plugin/plugin.json
if [ "$(jq -r '.name' "$mp" 2>/dev/null)" = aether ] &&
   [ "$(jq -r '.plugins[0].name' "$mp" 2>/dev/null)" = aether-wfl ] &&
   [ "$(jq -r '.plugins[0].source' "$mp" 2>/dev/null)" = ./plugin ] &&
   [ "$(jq -r '.name' "$pj" 2>/dev/null)" = aether-wfl ] &&
   [ "$(jq -r '.version' "$pj" 2>/dev/null)" = 3.1.1 ]; then
  ok T1 "marketplace aether, plugin aether-wfl 3.1.1"
else
  nok T1 "manifests wrong or missing ($mp, $pj)"
fi

# T2: no namespaced old-style command reference outside CHANGELOG.md
pat='(^|[^-a-z])wf''l:'
out=$(git grep -nE "$pat" -- . ':(exclude)CHANGELOG.md' 2>/dev/null)
st=$?
if [ "$st" -eq 1 ] && [ -z "$out" ]; then
  ok T2 "no old-namespace references"
else
  nok T2 "old-namespace references found (git grep exit $st): $(printf %s "$out" | head -n 5)"
fi

# T3: v2 gone, tag v2-final resolves to ce9c27b
gone=1
for p in bin/aether.js lib hosts templates scripts test package.json .github/workflows/publish.yml; do
  if [ -e "$p" ]; then gone=0; echo "# still exists: $p"; fi
done
tag=$(git rev-parse 'v2-final^{commit}' 2>/dev/null)
case "$tag" in
  ce9c27b*) tagok=1 ;;
  *) tagok=0 ;;
esac
if [ "$gone" -eq 1 ] && [ "$tagok" -eq 1 ]; then
  ok T3 "v2 removed; v2-final = $tag"
else
  nok T3 "v2 files remain ($((1-gone))) or tag v2-final wrong ('$tag')"
fi

# T11: no personal paths or internal names in tracked files
pat2='/Us''ers/|code''clouds|job-orch''estration|lead''audit|noc-back''end|LL-[0-9]+'
out=$(git grep -nE "$pat2" 2>/dev/null)
st=$?
if [ "$st" -eq 1 ] && [ -z "$out" ]; then
  ok T11 "no internal names or personal paths"
else
  nok T11 "matches found (git grep exit $st): $(printf %s "$out" | head -n 5)"
fi

exit "$rc"
