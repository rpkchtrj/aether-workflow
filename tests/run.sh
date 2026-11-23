#!/bin/sh
# Run every tests/test-*.sh. Each prints "ok <ID> ..." / "not ok <ID> ..." lines.
# Exits non-zero when any test script fails or prints a "not ok" line.
T=$(cd "$(dirname "$0")" && pwd)
fail=0 total=0 passed=0
out=$(mktemp)
for f in "$T"/test-*.sh; do
  [ -f "$f" ] || continue
  interp=$(head -n 1 "$f" | sed -n 's|^#![[:space:]]*\(/usr/bin/env[[:space:]]\{1,\}\)\{0,1\}\([^[:space:]]*\).*|\2|p')
  interp=${interp##*/}
  [ -n "$interp" ] || interp=bash
  if ! "$interp" "$f" >"$out" 2>&1; then fail=1; echo "not ok SCRIPT $(basename "$f") exited non-zero"; fi
  cat "$out"
  n=$(grep -c '^ok ' "$out"); m=$(grep -c '^not ok ' "$out")
  passed=$((passed + n)); total=$((total + n + m))
  [ "$m" -eq 0 ] || fail=1
done
rm -f "$out"
echo "# $passed/$total passed"
exit "$fail"
