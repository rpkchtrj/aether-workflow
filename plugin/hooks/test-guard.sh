#!/usr/bin/env bash
# PreToolUse guard: asks the user before an agent weakens a test to make it pass.
# Triggers on: removed or changed assertion lines, added skips, overwriting an existing
# test file, editing snapshots/golden files, and snapshot-update flags in test commands.
# Adding new tests and new assertions passes through.
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")

ask() {
  jq -n --arg r "Test change needs approval: $1. A failing test is the spec: fix the code. If the test itself is wrong, say why before changing it." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
  exit 0
}

test_re='(_test\.go|\.(test|spec)\.[cm]?[jt]sx?|(^|/)test_[^/]*\.py|_test\.py|_spec\.rb|Test\.(java|kt)|Tests?\.cs)$|(^|/)(__tests__|tests?|spec)/'
snap_re='(\.snap|\.golden)$|(^|/)(__snapshots__|testdata/golden)/'
assert_re='expect\(|assert|\.to(Be|Equal|Match|Throw|Have|Contain|StrictEqual)|\bt\.(Error|Fatal|Fail)|require\.|\bShould|\.should|Verify|toMatchSnapshot'
skip_re='\.(skip|only|todo)\(|\b(xit|xdescribe|xtest)\(|t\.Skip|pytest\.mark\.(skip|xfail)|@(Disabled|Ignore)\b|unittest\.skip'

if [ "$tool" = "Bash" ]; then
  cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
  if grep -qE '(jest|vitest|test|pytest|go test)' <<<"$cmd" && grep -qE '(^|[[:space:]])(-u|--updateSnapshot|--update-snapshots?|--snapshot-update|-update|--update-golden)([[:space:]=]|$)|UPDATE_(SNAPSHOTS?|GOLDEN)=' <<<"$cmd"; then
    ask "the command updates snapshots or golden files"
  fi
  exit 0
fi

path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -n "$path" ] || exit 0
if grep -qE "$snap_re" <<<"$path"; then ask "editing snapshot/golden file $(basename "$path")"; fi
grep -qE "$test_re" <<<"$path" || exit 0

case "$tool" in
  Write)
    [ -f "$path" ] && ask "overwriting existing test file $(basename "$path")"
    exit 0 ;;
  Edit)
    old=$(jq -r '.tool_input.old_string // empty' <<<"$input")
    new=$(jq -r '.tool_input.new_string // empty' <<<"$input") ;;
  MultiEdit)
    old=$(jq -r '[.tool_input.edits[]?.old_string] | join("\n")' <<<"$input")
    new=$(jq -r '[.tool_input.edits[]?.new_string] | join("\n")' <<<"$input") ;;
  *) exit 0 ;;
esac

# New skips that weren't there before.
if grep -qE "$skip_re" <<<"$new" && ! grep -qE "$skip_re" <<<"$old"; then
  ask "adds a skip/only/todo in $(basename "$path")"
fi

# Any existing assertion line that doesn't survive verbatim.
while IFS= read -r line; do
  trimmed=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<<"$line")
  [ -n "$trimmed" ] || continue
  grep -qF -- "$trimmed" <<<"$new" || ask "removes or changes an assertion in $(basename "$path"): $trimmed"
done < <(grep -E "$assert_re" <<<"$old" || true)

exit 0
