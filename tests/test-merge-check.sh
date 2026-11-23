#!/usr/bin/env bash
# Tests T1-T7 for plugin/bin/wfl-merge-check. Prints "ok <ID> ..." / "not ok <ID> ...".
HERE=$(cd "$(dirname "$0")" && pwd)
MC="$HERE/../plugin/bin/wfl-merge-check"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
fail=0
TMPS=()
cleanup() { rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

res() { # res <ID> <desc> <cond-exit>
  if [ "$3" -eq 0 ]; then echo "ok $1 $2"; else echo "not ok $1 $2"; fail=1; fi
}
has() { grep -qF -- "$2" <<<"$1"; }
sect() { # sect <output> <heading>: body of one section
  awk -v h="## $2" '$0==h{p=1;next} /^## /{p=0} p' <<<"$1"
}

R=""
g() { git -C "$R" -c user.name=t -c user.email=t@example.invalid "$@"; }
mkrepo() { # mkrepo: fresh repo on main in $R
  R=$(mktemp -d); TMPS+=("$R")
  git init -q -b main "$R"
}
commit() { g add -A && g commit -q -m "$1"; }
branches() { g branch -q target main && g branch -q source main; }
LIB='foo() {
  echo one
  echo two
  echo three
  echo four
  echo five
  echo six
  echo seven
  echo eight
  echo nine
  echo end
}
bar() {
  echo bar-old
}
'
# T6 state check after each run
OUT=""; ERR=""; RC=0
run() { # run: executes the tool in $R, records state-change info into T6FAIL
  local ts ss wl
  ts=$(git -C "$R" rev-parse target); ss=$(git -C "$R" rev-parse source)
  wl=$(git -C "$R" worktree list)
  OUT=$(cd "$R" && "$MC" source target 2>/tmp/mc-err.$$); RC=$?
  ERR=$(cat /tmp/mc-err.$$); rm -f /tmp/mc-err.$$
  [ "$ts" = "$(git -C "$R" rev-parse target)" ] || T6FAIL=1
  [ "$ss" = "$(git -C "$R" rev-parse source)" ] || T6FAIL=1
  [ "$wl" = "$(git -C "$R" worktree list)" ] || T6FAIL=1
  [ -z "$(git -C "$R" status --porcelain)" ] || T6FAIL=1
}
T6FAIL=0

# T1 conflict
mkrepo; printf 'x\n' >"$R/a.txt"; commit base; branches
g checkout -q target; printf 'y\n' >"$R/a.txt"; commit t
g checkout -q source; printf 'z\n' >"$R/a.txt"; commit s
g checkout -q main
run
c=0; [ "$RC" -eq 0 ] && has "$OUT" "## Conflicts" && has "$(sect "$OUT" Conflicts)" "a.txt" && ! has "$OUT" "## Clean merge" || c=1
res T1 "conflict reported, no clean merge" $c

# T2 both sides, same function
mkrepo; printf '%s' "$LIB" >"$R/lib.sh"; commit base; branches
g checkout -q target; sed -i.bak 's/echo one/echo ONE-target/' "$R/lib.sh"; rm "$R/lib.sh.bak"; commit t
g checkout -q source; sed -i.bak 's/echo end/echo END-source/' "$R/lib.sh"; rm "$R/lib.sh.bak"; commit s
g checkout -q main
run
b=$(sect "$OUT" "Both sides changed")
c=0; [ "$RC" -eq 0 ] && has "$b" "lib.sh" && has "$b" "foo" && has "$OUT" "## Clean merge" || c=1
res T2 "both sides: lib.sh and foo" $c

# T3 upstream function the target side calls
mkrepo; printf '%s' "$LIB" >"$R/lib.sh"; commit base; branches
g checkout -q target; printf '#!/bin/sh\n. ./lib.sh\nbar\n' >"$R/app.sh"; commit t
g checkout -q source; sed -i.bak 's/bar-old/bar-new/' "$R/lib.sh"; rm "$R/lib.sh.bak"; commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && has "$u" '`bar`' && has "$u" "app.sh:3" || c=1
res T3 "upstream bar called from app.sh:3" $c

# T4 decisions
mkrepo; mkdir -p "$R/src/pay" "$R/.decisions"; printf 'echo hi\n' >"$R/src/pay/x.sh"; printf 'A=1\n' >"$R/cfg.sh"
printf -- '- [2026-01-01-pay](2026-01-01-pay.md) accepted | pay rules | paths: src/pay/ | interfaces: env PAY_KEY\n' >"$R/.decisions/INDEX.md"
printf '.decisions\n' >"$R/.gitignore"
commit base; branches
g checkout -q source; printf 'echo changed\n' >"$R/src/pay/x.sh"; printf 'A=1\nPAY_KEY=abc\n' >"$R/cfg.sh"; commit s
g checkout -q main
run
d=$(sect "$OUT" "Decisions touched")
n=$(grep -c '2026-01-01-pay' <<<"$d")
c=0; [ "$RC" -eq 0 ] && [ "$n" -eq 2 ] && has "$d" "src/pay/" && has "$d" "PAY_KEY" || c=1
res T4 "decision listed for path and interface" $c

# T5 disjoint changes
mkrepo; printf 'x\n' >"$R/a.txt"; commit base; branches
g checkout -q target; printf 'y\n' >"$R/a.txt"; commit t
g checkout -q source; printf 'new\n' >"$R/b.txt"; commit s
g checkout -q main
run
c=0; [ "$RC" -eq 0 ] && has "$OUT" "## Clean merge" || c=1
for h in "Conflicts" "Both sides changed" "Upstream changes your side calls" "Decisions touched"; do has "$OUT" "## $h" && c=1; done
res T5 "no false alerts, clean merge" $c
c=0; sect "$OUT" "Clean merge" | grep -qE '^Tree: `[0-9a-f]{40}`$' || c=1
res T5 "Clean merge section has a 40-hex tree id" $c

# T6 changes nothing (accumulated over T1-T5 runs)
res T6 "branch shas, worktrees and working tree unchanged" "$T6FAIL"

# T7 invalid branch name
mkrepo; printf 'x\n' >"$R/a.txt"; commit base; branches
ERR=$(cd "$R" && "$MC" 'x`touch pwned`' target 2>&1 >/dev/null); RC=$?
c=0; [ "$RC" -eq 2 ] && has "$ERR" "invalid branch name" && [ ! -e "$R/pwned" ] && [ ! -e pwned ] || c=1
res T7 "invalid name: exit 2, message, no pwned file" $c

# T7b a name with a single quote and $(...) passes check-ref-format but must be rejected by the name pattern
mkrepo; printf 'x\n' >"$R/a.txt"; commit base; branches
BAD="x'\$(touch\${IFS}PWNED)'"
ERR=$(cd "$R" && "$MC" "$BAD" target 2>&1 >/dev/null); RC=$?
c=0; [ "$RC" -eq 2 ] && has "$ERR" "invalid branch name" && [ -z "$(find "$R" . -maxdepth 2 -name PWNED -not -path '*/.git/*' 2>/dev/null)" ] || c=1
res T7b "quote and command substitution in name: exit 2, invalid branch name, no PWNED file" $c

# T3b real function names for TS, Go, Python and a class method (not keywords like export)
mkrepo
printf 'export function computeTotal(a: number) {\n  const x = a + 1;\n  return x;\n}\n' >"$R/total.ts"
printf 'package repo\n\ntype Repo struct{}\n\nfunc (r *Repo) Save(v int) error {\n\t_ = v\n\treturn nil\n}\n' >"$R/repo.go"
printf 'class A:\n    def run(self):\n        x = 1\n        return x\n' >"$R/util.py"
printf 'export class Svc {\n  handle(a: number) {\n    const y = a;\n    return y;\n  }\n}\n' >"$R/svc.ts"
commit base; branches
g checkout -q target
printf 'import { computeTotal } from "./total";\ncomputeTotal(1);\nnew Svc().handle(2);\n' >"$R/use.ts"
printf 'package repo\n\nfunc use(r *Repo) {\n\tr.Save(2)\n}\n' >"$R/use.go"
printf 'A().run()\n' >"$R/use.py"
commit t
g checkout -q source
sed -i.bak 's/a + 1/a + 2/' "$R/total.ts"; rm "$R/total.ts.bak"
sed -i.bak 's/_ = v/_ = v + 1/' "$R/repo.go"; rm "$R/repo.go.bak"
sed -i.bak 's/x = 1/x = 2/' "$R/util.py"; rm "$R/util.py.bak"
sed -i.bak 's/const y = a/const y = a + 1/' "$R/svc.ts"; rm "$R/svc.ts.bak"
commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && has "$u" '`computeTotal`' && has "$u" '`Save`' && has "$u" '`run`' && has "$u" '`handle`' && ! has "$u" '`export`' && ! has "$u" '`class`' || c=1
res T3b "TS/Go/Python/class-method names listed, export not listed" $c

# T3c a change inside a useEffect callback is attributed to Panel, never to useEffect
mkrepo
printf 'export function Panel(p: { id: number }) {\n  useEffect(() => {\n    load(p.id);\n  }, []);\n  return null;\n}\n' >"$R/Panel.tsx"
commit base; branches
g checkout -q target
printf 'import y from "./y";\nuseEffect(() => {});\nPanel({ id: 1 });\n' >"$R/Other.tsx"
commit t
g checkout -q source
sed -i.bak 's/load(p.id)/load(p.id + 1)/' "$R/Panel.tsx"; rm "$R/Panel.tsx.bak"
commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && has "$u" '`Panel` -> `Other.tsx:3`' && ! has "$u" '`useEffect`' || c=1
res T3c "useEffect callback change: Panel -> Other.tsx:3 listed, useEffect not listed" $c

# T3c2 a change below a local const inside a function is never attributed to the const
mkrepo
printf 'export function compute(a: number) {\n  const x = a + 1;\n  return x * 2;\n}\n' >"$R/c.ts"
commit base; branches
g checkout -q target
printf 'import { compute } from "./c";\ncompute(1);\nx(2);\n' >"$R/use.ts"
commit t
g checkout -q source
sed -i.bak 's/x \* 2/x * 3/' "$R/c.ts"; rm "$R/c.ts.bak"
commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && ! has "$u" '`x` ->' && has "$u" '`use.ts:2`' || c=1
res T3c2 "change below a local const: attributed to enclosing function, never to x" $c

# T3d a change inside a typed const component is attributed to Panel, not the function above it
mkrepo
printf 'export function helper() {\n  return 1;\n}\nexport const Panel: React.FC<Props> = ({ id }) => {\n  return id;\n};\nexport const handler: Handler = async (event) => {\n  return event;\n};\n' >"$R/c.ts"
commit base; branches
g checkout -q target
printf 'Panel({ id: 1 });\nhelper();\n' >"$R/use.ts"
commit t
g checkout -q source
sed -i.bak 's/return id;/return id + 1;/' "$R/c.ts"; rm "$R/c.ts.bak"
commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && has "$u" '`Panel` -> `use.ts:1`' && ! has "$u" '`helper`' || c=1
res T3d "typed const component change: Panel -> use.ts:1 listed, helper not listed" $c

# T3e a change inside a class-property arrow is attributed to handle, not the method above it
mkrepo
printf 'class A {\n  other() {\n    return 1;\n  }\n  handle = (x) => {\n    return x;\n  };\n  state = 1;\n}\n' >"$R/c.ts"
commit base; branches
g checkout -q target
printf 'a.handle(1);\na.other();\n' >"$R/use.ts"
commit t
g checkout -q source
sed -i.bak 's/return x;/return x + 1;/' "$R/c.ts"; rm "$R/c.ts.bak"
commit s
g checkout -q main
run
u=$(sect "$OUT" "Upstream changes your side calls")
c=0; [ "$RC" -eq 0 ] && has "$u" '`handle` -> `use.ts:1`' && ! has "$u" '`other`' || c=1
res T3e "class-property arrow change: handle -> use.ts:1 listed, other not listed" $c

# T10 merge-tree failing with an exit code other than 0 or 1: stderr message, non-zero exit
mkrepo; printf 'x\n' >"$R/a.txt"; commit base; branches
SHIM=$(mktemp -d); TMPS+=("$SHIM")
REALGIT=$(command -v git)
printf '#!/bin/sh\nfor a in "$@"; do [ "$a" = merge-tree ] && { echo "fatal: simulated failure" >&2; exit 128; }; done\nexec "%s" "$@"\n' "$REALGIT" >"$SHIM/git"
chmod +x "$SHIM/git"
OUT=$(cd "$R" && PATH="$SHIM:$PATH" "$MC" source target 2>/tmp/mc-err10.$$); RC=$?
ERR=$(cat /tmp/mc-err10.$$); rm -f /tmp/mc-err10.$$
c=0; [ "$RC" -ne 0 ] && has "$ERR" "merge-tree failed" && has "$ERR" "simulated failure" || c=1
res T10 "merge-tree exit 128: message on stderr, non-zero exit" $c

exit $fail
