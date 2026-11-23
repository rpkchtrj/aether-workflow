#!/usr/bin/env bash
# Doc checks. Prints "ok <ID> ..." / "not ok <ID> ...".
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
rc=0
ok() { echo "ok $1 $2"; }
nok() { echo "not ok $1 $2"; rc=1; }

# ---- T12 begin: plan-change step 12 is unchanged from base (apart from the rename) ----
# Base: step 12 of the plan-change skill as of the dotfiles base commit, with the
# command namespace renamed to aether-wfl. Embedded so the test needs no other repo.
base_text() { cat <<'BASE_EOF'
## 12. Implement

You (the session that approved the plan) coordinate and do nothing heavy yourself: you dispatch workers, talk to the user, sequence the steps and keep the index report. Workers implement, check, commit, verify and review, each a fresh general-purpose subagent with an explicit `model`, and each returns a short summary (at most ~10 lines) while writing its detail to its own report file. Subagents cannot start subagents, so every worker below is started by you. Every worker prompt ends with: "Run one plain command per Bash call from the repo root: no `cd`, `;`, `&&` or `echo $?`."

Group the slices into waves: a wave holds slices whose `Depends on` are all in earlier waves; slices in one wave that share a file move to a later wave. Ask once: "Implement now? Waves: 1: L1, L3 · 2: L2 · … One commit per wave on `<branch>`, then DoD checks and preflight until clean (at most 3 fix rounds). I stop for: <the gates below that apply>." Give no other options to pick from.

**No**: end with how to do it later: `/aether-wfl:plan-change <plan path>` and say "implement". Stop.

**Gates.** These stop the run until the user answers. Only you ask the user; never decide one yourself or work around one. Record each in the index report with what was asked, the user's answer and the time.
- the current branch is the repo's default branch or the plan's base branch (before the first commit);
- a worker reports the plan is wrong, or needs a file outside Allowed files, a changed test expectation or a new dependency;
- a wave check finds drift or a red suite;
- every `manual:` DoD item, before each DoD run;
- preflight findings that are not auto-fixable;
- the third fix round still leaves must-fixes.

**Reports.** `.plans/<slug>-report.md` is yours: plan, branch, base, start time; one line per step (wave, check, DoD run, preflight round, fix) with its outcome, commit and a link to the worker's file; every gate; at the end the final HEAD, what is open and what the user should check by hand. Each worker writes `.plans/<slug>-report/<NN>-<step>.md` (e.g. `03-wave-1-check.md`) with its full detail, written for a reader who saw none of the run. Write the index as you go, so an interrupted run still has its record.

**Yes**:
1. The working tree must be clean apart from `.plans/`; otherwise stop and ask the user to commit or set their changes aside first. Check the branch gate. Set `status: implementing`.
2. **Wave.** Launch one Sonnet worker per slice of the wave in a single message: "Implement slice <ID> of `<plan path>`. Follow its Implementer rules for a dispatched slice. Running in parallel: <other slices and their Files>. Write your detail to `<report file>`."
3. **Wave check.** Then one Sonnet worker, role *wave check* (below), with the wave's slices, their `Files` and the slice workers' summaries. A drift or red-suite result is a gate. If the check passed but its commit was denied, commit exactly the files it checked yourself, with its message, and note that in the index report. Next wave from 2.
4. After the last wave, loop through 5-7 until preflight has no must-fix. At most 3 fix rounds: must-fixes left after the third are a gate.
5. **DoD.** Ask the user to run each `manual:` item at HEAD (give the steps from the plan) and wait; in later rounds they may confirm an earlier result still holds. Then one Sonnet worker, role *DoD*, with the manual results. Re-run one or two of its cheap checks yourself; a mismatch is a gate.
6. **Preflight.** One Opus worker, role *preflight*. Its auto-fixable must-fixes go to 7; ask the user about each of the others, with the worker's evidence, and act on their answer.
7. No must-fix left: go to 8. Otherwise one Sonnet worker with the auto-fixable findings verbatim: "Fix these preflight findings in `<plan path>`'s change. Follow its Implementer rules for dispatched fixes. Write your detail to `<report file>`." Then a *wave check* of the files it changed, which commits the round as "Fix <what>". Back to 5 (new commits make the Done report stale).
8. **Finish.** In the Done report, mark the `/aether-wfl:preflight` baseline item met with the clean round as evidence. Update the decision records' `paths` and `interfaces` to the final diff, write the plan summary, `ctx sync --quiet` from the repo root, and complete the index report. Tell the user its path and what is open. The user sets `status: done`.

**Worker roles.** Put the role's instructions in its prompt; a worker reads the plan, not this skill.
- *Wave check* (`model: sonnet`): run `git status --porcelain`. Every new or changed file must belong to exactly one of the given slices' `Files` (or to the given fix); `.plans/` is ignored. Run the repo's full typecheck, lint and test suite. Both pass: stage the files by name (never `git add -A`) and commit with a short message saying what the wave delivers, not the slice IDs, following the repo's commit conventions and the user's attribution rules; never push. Either fails: commit nothing. Return the sha, or the drift or failing output.
- *DoD* (`model: sonnet`): "Run every Definition of done check in `<plan path>` at HEAD `<sha>` and fill in its Done report, following its Implementer rules on evidence. Manual items, as reported by the user: <results>. The `/aether-wfl:preflight` item stays open; preflight runs after you." Return the status per item.
- *Preflight* (`model: opus`): "Act as `/aether-wfl:preflight` for this change. Read `${CLAUDE_SKILL_DIR}/../preflight/SKILL.md` and `${CLAUDE_SKILL_DIR}/../preflight/reviewer.md`. Do SKILL.md steps 1-2 with base `<plan base sha>` and spec `<plan path>`, then do the review in reviewer.md yourself instead of dispatching it, and write the report to `<report file>`." Return the must-fix findings in two lists: *auto-fixable* (Breaks findings other than Safety and Weakened test, and Done report evidence gaps, which the next DoD run fixes) and *needs the user* (everything else: Security, Spec and Drift, Weakened test, Fit, anything needing a plan change, a test change or a new dependency), each with file:line and one line of evidence; plus the counts of should-fix and nice-to-have.
BASE_EOF
}
base=$(base_text)
cur=$(sed -n '/^## 12\. Implement/,$p' "$REPO/plugin/skills/plan-change/SKILL.md")
if [ -n "$cur" ] && [ "$cur" = "$base" ]; then
  ok T12 "step 12 section identical to base"
else
  nok T12 "step 12 section differs from base"
  _t=$(mktemp -d "${TMPDIR:-/tmp}/docs.XXXXXX")
  printf '%s\n' "$base" >"$_t/base"
  printf '%s\n' "$cur" >"$_t/cur"
  diff "$_t/base" "$_t/cur" | head -n 20
  rm -rf "$_t"
fi
if printf '%s' "$cur" | grep -qF 'Implement now?'; then
  ok T12 "step 12 contains 'Implement now?'"
else
  nok T12 "step 12 lacks 'Implement now?'"
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
