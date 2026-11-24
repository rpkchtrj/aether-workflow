#!/usr/bin/env bash
# Doc checks. Prints "ok <ID> ..." / "not ok <ID> ...".
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
rc=0
ok() { echo "ok $1 $2"; }
nok() { echo "not ok $1 $2"; rc=1; }

# ---- T12 begin: plan-change step 12 keeps the implement flow's invariants ----
cur=$(sed -n '/^## 12\. Implement/,$p' "$REPO/plugin/skills/plan-change/SKILL.md")
has() { printf '%s' "$cur" | grep -qF -- "$1"; }
if has 'Implement now?'; then ok T12 "step 12 asks 'Implement now?'"; else nok T12 "step 12 lacks 'Implement now?'"; fi
if [ -n "$cur" ] && ! printf '%s' "$cur" | grep -qE -- '-report(\.md|/)'; then
  ok T12 "step 12 writes no report files"
else
  nok T12 "step 12 mentions report files"
fi
if has 'skip reviewer.md check 12'; then ok T12 "preflight skips the Done report check"; else nok T12 "preflight still checks the Done report"; fi
if has 'At most 3 preflight runs'; then ok T12 "preflight capped at 3 runs"; else nok T12 "no 3-run preflight cap"; fi
fin=$(printf '%s' "$cur" | sed -n '/^7\. \*\*Finish\*\*/p')
if printf '%s' "$fin" | grep -qF 'when the user says done' &&
   printf '%s' "$fin" | grep -qF 'role *DoD*' &&
   [ "$(printf '%s' "$fin" | grep -bo 'role \*DoD\*' | cut -d: -f1)" -lt "$(printf '%s' "$fin" | grep -bo 'set `status: done`' | cut -d: -f1)" ]; then
  ok T12 "DoD runs after the user says done and before status: done"
else
  nok T12 "finish order is not: user done, DoD, status: done"
fi
if has 'never add design or implementation guidance'; then ok T12 "worker prompts carry no coordinator design hints"; else nok T12 "worker prompts may carry coordinator design hints"; fi
pc="$REPO/plugin/skills/plan-change/SKILL.md"
if grep -qF 'base: <branch this change merges into>' "$pc" && grep -qF 'preflight/find-base.sh' "$pc"; then
  ok T12 "plan base is the merge target, found with find-base.sh"
else
  nok T12 "plan base may record the current branch"
fi
# ---- T12 end ----

# ---- T10 begin: the docs name every shipped skill and the install route ----
for d in "$REPO"/plugin/skills/*/; do
  s=$(basename "$d")
  if grep -qF "/aether-wfl:$s" "$REPO/WORKFLOW.md"; then
    ok T10 "WORKFLOW.md names /aether-wfl:$s"
  else
    nok T10 "WORKFLOW.md lacks /aether-wfl:$s"
  fi
done
if grep -qF 'install.sh' "$REPO/README.md"; then
  ok T10 "README.md mentions install.sh"
else
  nok T10 "README.md lacks install.sh"
fi
if grep -qF 'aether-wfl@aether' "$REPO/README.md"; then
  ok T10 "README.md mentions aether-wfl@aether"
else
  nok T10 "README.md lacks aether-wfl@aether"
fi
# ---- T10 end ----

exit "$rc"
