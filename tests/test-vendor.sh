#!/usr/bin/env bash
# T4: vendored diagnosing-bugs matches upstream; LICENSE is MIT; exactly 8 skills.
# Prints "ok T4 ..." / "not ok T4 ...".
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
cd "$REPO" || exit 1
rc=0
ok() { echo "ok $1 $2"; }
nok() { echo "not ok $1 $2"; rc=1; }

V=plugin/skills/diagnosing-bugs
fail=0

# Source dir: $AETHER_UPSTREAM_MP, else the cache path recorded in UPSTREAM ("Cache:" line, "~" = $HOME).
src=$AETHER_UPSTREAM_MP
if [ -z "$src" ]; then
  rec=$(sed -n 's/^Cache: *//p' "$V/UPSTREAM" 2>/dev/null | head -n 1)
  case "$rec" in
    "~/"*) src="$HOME/${rec#\~/}" ;;
    *) src=$rec ;;
  esac
fi

# Exactly the 8 skills
want="codemap dead-code diagnosing-bugs plan-change pr preflight pull security-audit"
have=$(ls plugin/skills | tr '\n' ' ' | sed 's/ $//')
if [ "$have" != "$want" ]; then
  nok T4 "plugin/skills is '$have', want '$want'"
  fail=1
fi

# LICENSE line 1
if [ "$(head -n 1 "$V/LICENSE" 2>/dev/null)" != "MIT License" ]; then
  nok T4 "$V/LICENSE line 1 is not 'MIT License'"
  fail=1
fi

# Diff against upstream
if [ -z "$src" ] || [ ! -d "$src" ]; then
  [ "$fail" -eq 0 ] && ok T4 "skipped: upstream not present"
else
  out=$(diff -r -x UPSTREAM -x LICENSE "$src" "$V" 2>&1)
  if [ -n "$out" ]; then
    nok T4 "vendored copy differs from upstream: $(printf %s "$out" | head -n 5)"
    fail=1
  fi
  [ "$fail" -eq 0 ] && ok T4 "diagnosing-bugs matches upstream; LICENSE MIT; 8 skills"
fi

exit "$rc"
