---
name: plan-change
description: Plan a code change before any implementation: user-owned definition of done with evidence-backed completion, reuse inventory (helpers and installed libraries), dependency check, blast radius, security findings for the human to decide, test scenarios (Given/When/Then) for approval, and slices of at most ~300 net lines. Writes .plans/<slug>.md and stops at an approval gate. Use for any feature, refactor or non-trivial fix, or when the user says plan this.
model: opus
argument-hint: "<task description, ticket path, or issue>"
---

# /aether-wfl:plan-change

Produces an approved plan that an implementer (Sonnet subagent, Orca worker, or the user) follows, and that `/aether-wfl:preflight` later checks the diff against. Writes no code. The only files written are the plan and, at approval, its decision records.

## 0. Resolve the location

A plan belongs to the branch it is made for, so it lives in the **current worktree** (the Orca workspace you are in). Only the codemap is shared, in the main checkout.

```bash
root=$(git rev-parse --show-toplevel)
common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$( [ "$(basename "$common")" = ".git" ] && dirname "$common" || echo "$root" )
mkdir -p "$root/.plans"
```

`.plans/` is git-ignored, so removing the workspace deletes the plan. Say so once when you first write it. What is worth keeping survives as a plan summary in `.decisions/`, written after the final commit (see **Plan summary** below).

Decisions outlive the plan: they go to `$root/.decisions/`, a link into `~/Context/<repo>/.decisions/` that every worktree of the repo shares (`bin/ctx`; outside the repo's git, versioned in the store's local git). `ctx add .decisions` once per session makes sure it is linked here (safe to repeat).

## 1. Load context

- Revising an existing plan (a plan path was passed, or the user says they reviewed it): skip to **11. Revise**.
- An `approved` plan and the user asks to implement it: skip to **12. Implement**.
- Read `$main/.plans/CODEMAP.md`. Missing, or its `Mapped at` commit is far behind HEAD in the directories this task touches: if `$root` is `$main`, run `/aether-wfl:codemap` first (it runs on Sonnet). In a worktree it refuses to write (the map belongs to the main checkout's branch), so ask the user to run it there, or, when the worktree is on another branch (a hotfix off `main`), say the map describes the main checkout's branch and read the files this task touches instead of trusting their entries.
- Read `$root/.decisions/INDEX.md` if it exists. After the codemap tells you which paths and interfaces this task touches, open every decision whose `paths` or `interfaces` overlap them (a path overlaps when one is a prefix of the other). These are constraints from earlier features. Entries marked `summary` are context (why an earlier feature was shaped as it was, what it deferred), not constraints; a deferred security finding in one is worth re-raising if this task touches its path.
- Read the task, ticket or issue. Read only the files the codemap points to for this task, then their callers.
- Small and obvious (one file, under ~30 lines, no new function, no trust boundary): say so and suggest skipping the plan. The user decides.

## 2. Definition of done

The user owns the definition of done. Take it from the task or ticket. None given: ask for it once, before planning, offering a draft derived from the task that the user can accept or edit. It shapes everything below, so do not plan against a guessed one.

- Every item must be checkable. Give each an ID (`DoD1`…), the criterion, **how it is verified** (approved test IDs, a command with the expected output, a check against the running app or real environment, a query on stored data), and the evidence that will prove it. A vague item ("works well", "is fast", "secure") is rewritten into a checkable one, and the rewrite is shown at the gate.
- Append these baseline items unless the user removes them: all approved scenarios pass; typecheck, lint and the full test suite are green at the final commit; every security finding decided **fix** is fixed and its scenario passes; `/aether-wfl:preflight` reports no unresolved must-fix; repo obligations from `CLAUDE.md` are done (e.g. API collection sync for endpoint changes).
- If the change has a runtime surface (endpoint, UI, job, CLI), at least one item verifies it in the running app or real environment, not only in tests.
- A check only the user can run (the project needs its code run by hand, or a real environment agents cannot reach): `Verified by` is `manual: <exact steps and what to look for>`. When the draft has a runtime surface and no manual item, ask once whether this project needs one. Step 12 stops for every manual item before the DoD run.

## 3. Reuse inventory (before designing anything new)

For each piece of behaviour the change needs:

1. Search the codemap's helpers, then grep the repo for the verb and the noun.
2. Record the result as one of:
   - **reuse** `path:line name`: used as is.
   - **extend** `path:line name`: only when the extension keeps the function meaning the same thing for every existing caller. Adding a boolean or mode flag that switches behaviour is not an extension; that is two functions. List every existing caller the extension affects.
   - **new**: name, signature, the module it goes in, and why no existing helper or installed library fits (name what you checked).
3. Same for libraries: check installed dependencies before the standard library before anything new. A **new dependency** needs: what it replaces, size and maintenance status, license, and why a few lines of code or an installed library won't do. New dependencies are always a decision for the user.

## 4. Blast radius

List what the change can break, with evidence (LSP find-references or grep, not guesses):

- Changed functions or types and **every caller** of each (path:line).
- Public interfaces: HTTP routes, events and queue payloads, CLI flags, exported package APIs, DB schema, config and env vars.
- Data: migrations, backfills, writes to existing records.
- Tests that cover the touched code, and touched risky code that has none.
- Files the implementer may touch. Anything outside this list is drift.
- Prior decisions: re-check `INDEX.md` against the final list of files and interfaces above. For each overlapping decision, say how this plan respects it, or that it contradicts it. A contradiction is a decision for the user: keep the earlier decision and change the plan, or supersede it (a new decision record that names the one it replaces).

## 5. Security review of the plan

Check the change against the codemap's security surfaces and these: authentication and authorisation on every new or changed entry point; input validation at trust boundaries; injection (SQL, shell, template, path, header); secrets in code, logs or errors; data exposure in responses and logs; SSRF on outbound calls built from input; race conditions on check-then-write; unsafe defaults; dependency risk.

Each finding must name: the code path, who the attacker is, what they do, what they get, a severity (critical / high / medium / low), and a suggested fix. No concrete exploit path: not a finding. Generic advice ("consider rate limiting") is dropped.

The user decides every finding: **fix in this change**, **defer** (with a reason), or **accept**. Never decide for them.

## 6. Test scenarios

The approved tests are the contract the implementation is checked against. Write them as behaviour, not code, so the user can read and approve them.

- One scenario per behaviour the change adds or alters, plus: each edge case that matters for this change (empty, zero, missing, duplicate, boundary, concurrent, failure of a called service); one regression scenario per bug being fixed; one scenario per security finding decided **fix**, asserting the attack fails.
- Each scenario: an ID (`T1`, `T2`…), the slice, the level (unit / integration / e2e, at the seam the repo already tests at), the test file, **Given / When / Then** with concrete values, and the exact observable result asserted (return value, status code, stored row, emitted event, error type and message). "Works correctly" or "handles errors" is not a Then.
- Existing tests: list each existing test the change affects and mark it **unchanged** (must still pass as is) or **changes**, with the old and new expectation and the plan line that justifies it. A changed expectation is a decision for the user.
- Check each DoD item against the scenarios it cites: the same input must expect the same output in both. Fix any contradiction before the gate.
- Keep it lean: no scenario that only re-tests a library or a trivial getter. If two scenarios differ only by input, make them one table-driven scenario.

## 7. Size and slices

Estimate net added lines per file. Budget: **~300 net lines per slice**. Over budget: split into slices that each build, pass tests and are reviewable alone, in dependency order. If a single slice can't get under budget, say why and let the user decide.

Prefer the design with fewer new lines when readability and extension points are equal. Do not compress code to meet the budget; split instead.

Give each slice its exact `Files` and `Depends on` (the slice IDs whose code it needs, or `-`). Step 12 runs slices in parallel only when neither depends on the other and their `Files` don't overlap, so list shared files honestly (install and build scripts, config, lockfiles, fixtures, snapshots).

## 8. Decisions to record

Most choices in a plan are not worth a decision record. Propose one only for a choice that is **hard to reverse**, **would surprise a later reader without context**, and **rejected a real alternative**: a data shape or schema, an interface other code will call or consume, a library, a security decision deferred or accepted, an alternative chosen after a `reject:`, a prior decision this plan supersedes. Typical feature: 0 to 3. None qualify: write "None".

Each candidate gets an ID (`A1`…), a one-line decision, and its **span**, which is how a later feature finds it:
- `paths`: the deepest folders or files this feature creates or owns. Not a shared parent (`src/functions/` spans every Lambda and matches everything).
- `interfaces`: what other code can depend on without touching those paths: DB tables and columns, events and queue payloads, HTTP routes, exported functions, env vars, config keys, files written for others to read. Features couple through these far more often than through folders, so this is the field that catches a dependency a folder match would miss.

## 9. Write the plan

Slug: short kebab-case of the task. File: `$root/.plans/<slug>.md`.

Base: the branch this change will merge into, not the branch you are on (a plan made on a feature branch must not name that branch, or step 12's branch gate always fires). Run `bash ${CLAUDE_SKILL_DIR}/../preflight/find-base.sh` from the repo root; it prints `<branch> <how>`. It exits non-zero, or you are on the repo's default branch: ask once which branch this merges into. The sha is `git merge-base <base> HEAD`.

```markdown
---
status: draft            # draft -> approved -> implementing -> done
slug: <slug>
base: <branch this change merges into> @ <short sha of its merge-base with HEAD>
created: <YYYY-MM-DD>
approved: <YYYY-MM-DD or empty>
---
# <title>

## Approval
- [ ] **Approve the whole plan as is.** Tick this alone to approve every item below as written, including each security finding's proposed decision. Otherwise review section by section or item by item.

Each section with items has its own **Approve section** box. Ticking it approves every item in that section (security findings: their proposed decision), except the items whose `Review` you fill with `change:` or `reject:`; only those are revised.

How to review an item: write in its `Review` cell
- `ok`: approved as written
- `change: <what to change>`: revise it as described
- `reject: <why>`: drop it and propose alternatives
- leave it empty: not reviewed yet
Security findings also take `fix`, `defer: <reason>` or `accept: <reason>`.
Then run `/aether-wfl:plan-change <this file>` (or say "reviewed") to apply the review.

## Intent
<2-4 sentences>. Non-goals: <list>.

## Definition of done
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Criterion | Verified by | Evidence expected | Review |
|---|---|---|---|---|
| DoD1 | <checkable outcome> | T1, T2 / `<command>` / live check: <steps> | <what output proves it> | |

## Reuse inventory
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Need | Decision | Where | Note | Review |
|---|---|---|---|---|---|
| R1 | ... | reuse / extend / new | path:line | callers affected, or why new | |

## Dependencies
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
None new. | table:
| ID | Dependency | Justification | Review |
|---|---|---|---|
| D1 | <name> | <what it replaces, size, license, why> | |

## Blast radius
- [ ] **Approve section.** Everything here is approved except what the `Review` line below asks to change.
- Changes: <symbol (path:line)>; callers: <path:line, ...>
- Interfaces: ...
- Data: ...
- Allowed files: <list>

Review: <empty, `ok`, or `change: <what>` (e.g. `change: drop src/x.ts from Allowed files`)>

## Prior decisions
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Decision | Overlap | How this plan relates | Review |
|---|---|---|---|---|
| P1 | <decision id> | <path or interface> | respects: <how> / supersedes: <why> | |

## Security
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Finding | Severity | Suggested fix | Proposed decision | Review |
|---|---|---|---|---|---|
| S1 | ... | high | ... | fix | |

## Test scenarios
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Slice | Level | File | Given | When | Then (asserted) | Covers | Review |
|---|---|---|---|---|---|---|---|---|
| T1 | 1 | unit | path | <state, concrete values> | <action> | <exact result> | intent / edge / S1 / bug | |

Existing tests affected:
| ID | Test (path:name) | Status | Old expectation -> new | Why | Review |
|---|---|---|---|---|---|
| E1 | ... | unchanged / changes | ... | plan line | |

## Slices
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Slice | Depends on | Files | Net lines | Tests | Review |
|---|---|---|---|---|---|---|
| L1 | <name> | - | <files> | ~<N> | T1, T2 | |

Each slice is done when its tests pass and existing tests stay green.

## Decisions to record
- [ ] **Approve section.** Every item here is approved except those whose `Review` says `change:` or `reject:`.
| ID | Decision | Alternatives rejected | Paths | Interfaces | Review |
|---|---|---|---|---|---|
| A1 | <one line> | <what and why not> | <deepest folders/files> | <tables, events, routes, exports, env> | |

## Review log
<!-- one line per review round: date, items changed / replaced / dropped -->

## Implementer rules
- Follow this plan. Touch only Allowed files. Add only functions and dependencies listed above.
- If the plan turns out wrong (a helper doesn't fit, a file outside the list must change, a slice exceeds ~300 lines), stop and report; do not improvise. The plan is amended and re-approved first.
- Run the repo's typecheck, lint and tests for each slice. Report what ran and the result.
- A failing existing test means the code is wrong. Do not edit existing tests or snapshots to pass; if a test is wrong, stop and report why.
- Tests first, per slice: write the slice's approved scenarios as tests, run them and confirm they fail for the right reason, then write the code until they pass. Name each test so it carries its ID (e.g. `T3: rejects expired token`).
- Implement each scenario exactly: same Given, When and asserted Then. Extra tests are fine and get listed in your report; never drop, merge or loosen an approved one.
- Dispatched by step 12 (any worker): run one plain command per Bash call from the repo root, with no `cd`, `;`, `&&` or `echo $?` (the exit status is in the tool result). A background worker cannot ask for permission, so a compound command with one unapproved part is denied.
- Dispatched for one slice (step 12 of `/aether-wfl:plan-change`): do only that slice and touch only its `Files`; other slices may be running in the same tree. Run the typecheck, lint and that slice's tests, not the full suite. Do not commit, fill the Done report or edit decision records. Report: files changed, each test ID with its command and quoted output, and any deviation or check you could not run.
- Dispatched to fix `/aether-wfl:preflight` findings (step 12): fix only the findings you were given, touch only the files they name or the plan's Allowed files, keep every approved test as is, run the full typecheck, lint and test suite. All pass: stage the files you changed by name (never `git add -A`) and commit as "Fix <what>", following the repo's commit conventions and the user's attribution rules; never push. Anything fails: commit nothing and report the output. Do not run the Definition of done checks, fill the Done report or write the plan summary. A fix that needs a file outside Allowed files, a changed test expectation or a new dependency: stop and report instead.
- In step 12 the coordinating session commits each wave and the fix worker commits each fix round, so "ask the user to commit" below does not apply there. Step 12 also runs the Definition of done checks after preflight, once the user says done, and the coordinating session writes the plan summary and sets `status: done`; the three rules below describe implementing outside step 12.
- After the final commit, update the `paths` and `interfaces` of this plan's decision records (and their `INDEX.md` lines) to what the final diff actually touches, then run `ctx sync --quiet`.
- Before calling the work done, the work must be committed (`/aether-wfl:preflight` reviews commits and re-runs evidence in a worktree built from HEAD). If you were not asked to commit, stop and ask the user to commit. Then run every Definition of done check at that commit and fill in the Done report below. Evidence is output you ran and saw in this session at that commit, quoted (secrets redacted): never "should pass", "expected to work" or a summary without output. Any item not met or not verifiable means the work is not done; say which and why. Do not set `status: done`; the user does after `/aether-wfl:preflight`.
- Fixing `/aether-wfl:preflight` findings makes new commits, so the Done report goes stale: once the fixes are committed (same rule: ask the user unless asked to commit), re-run every DoD check at the new HEAD and replace the Done report (and the decision records' `paths` and `interfaces` if the diff's span changed).
- When `/aether-wfl:preflight` reports no must-fix and the Done report's commit is HEAD: write the plan summary (format: **Plan summary** in `${CLAUDE_SKILL_DIR}/SKILL.md`) and run `ctx sync --quiet`. Whoever made the last fix does this; with no fixes, the session that ran `/aether-wfl:preflight`.

## Done report
Commit: <short sha> | Date: <YYYY-MM-DD>
| DoD | Status | What I did to verify | Evidence |
|---|---|---|---|
| DoD1 | met / not met / could not verify | <command run, or steps taken in the running app> | <quoted output: test pass lines with IDs, response, row, screenshot path> |

Not done / open: <items and why, or "none">.
```

## 10. Approval gate

The review happens in the plan file. In chat, give the plan path, show the **Definition of done** and **Test scenarios** tables in full (mark any DoD item you rewrote or added, with the original wording), and list the items that most need a look: each security finding, each **extend** that affects other callers, each new dependency, each existing test whose expectation changes, any over-budget slice, each prior decision this plan contradicts, and the proposed decision records (`A` items). Ask once; do not drip questions across turns, and do not ask about choices the codebase already settles.

The user reviews in the file (the `Approval` block, **Approve section** boxes and `Review` cells), or answers in chat by ID (`T3 change: use 0 not null, S1 accept: internal only, approve rest`) or by section (`approve Tests except T3 change: use 0 not null`); write chat answers into the `Review` cells and section boxes, then revise as in step 11. Stop here.

## 11. Revise

Read the plan and its `Approval` block, **Approve section** boxes and `Review` cells.

- **Whole plan ticked, no `change:` or `reject:` anywhere**: set every empty `Review` to `ok` and each security finding's `Review` to its proposed decision, then approve (below).
- **Whole plan ticked but some items say `change:` or `reject:`**: they conflict; ask which wins. Change nothing until answered.
- **Section ticked**: first set each empty `Review` in that section to `ok` (security findings: their proposed decision). Items with `change:` or `reject:` are not a conflict: they are the section's exceptions, handled per item below. If the section has any, untick its box after revising, so the revised and alternative rows (empty `Review`) wait for the user instead of being approved by the old tick.
- Then, per item:
  - `ok`, or `fix` / `defer:` / `accept:` on a security finding: keep it. Never edit an approved item, except when another change forces it; then set its `Review` back to empty and say why in the log.
  - `change:`: revise the item as asked, re-check what it touches (DoD links, tests, slices, allowed files, line budgets), and set its `Review` back to empty so the user confirms the new version.
  - `reject:`: remove the item and write 2 or 3 alternatives that answer the reason, as new rows with suffixed IDs (`T4a`, `T4b`) and empty `Review`, the one you'd pick first with a one-line why. Rejected with no workable alternative (e.g. a DoD item): say so and drop it.
  - empty: still unreviewed; leave it.
  - Blast radius has one `Review` line for the whole section instead of cells. `change:` there: revise the bullets as asked, re-check what follows from them (slices' `Files`, tests, line budgets, items that name those files), set the line back to empty and untick the box.
- Add one line to `Review log`: date, items changed, replaced, dropped.
- In chat: list only what changed and which items are still empty. Stop.

A set of alternatives is settled when the user marks one `ok`; delete the others. **Approve** when every remaining item's `Review`, and the Blast radius `Review` line, is `ok` (or a decision, for security findings): set `status: approved` and `approved:` to today, tick the `Approval` box and every **Approve section** box. Then write each `ok` decision record (below), and go to **12. Implement**.

**Write decision records.** Run `ctx add .decisions`; if `$root/.decisions` still does not exist, `mkdir` it (first decision in this repo; ctx adopts it). For each approved `A` item write `$root/.decisions/<YYYY-MM-DD>-<slug>.md` (date-and-slug names, so parallel branches never collide):

```markdown
---
id: <YYYY-MM-DD>-<slug>
status: accepted          # accepted | superseded by <id>
date: <YYYY-MM-DD>
feature: <plan title> (<branch>, plan <plan slug>)
at: <short sha the plan was based on>
paths: [<deepest folders/files>]
interfaces: [<table x.y, event a.b, route POST /p, export fn (file), env VAR>]
supersedes: <id or empty>
---
# <decision as a sentence>

## Context
<why a decision was needed: 2-4 sentences>

## Decision
<what was chosen, concretely>

## Alternatives rejected
- <alternative>: <why not>

## Consequences
<what later features must respect or will find, e.g. "anything reading audit scores goes through scoreFor(); the table's shape is not a public contract">
```

`INDEX.md` missing: create it with this header (an existing header lacking either `Format` line gets it added):

```markdown
# Decisions

Records of decisions made while building features, shared by every worktree of this repo (bin/ctx; not in the repo's git).
One line per entry: read this first, then open the ones whose `paths` or `interfaces` overlap what you are about to change.
Decisions (constraints): `- [<id>](<id>.md) <status> | <decision, one line> | paths: <...> | interfaces: <...>`
Plan summaries (what shipped, what to watch; context, not constraints): `- [<id>](<id>.md) summary | <what shipped> | watch: <deferred/accepted security, open items> | paths: <...> | interfaces: <...>`
```

Add one line per record to `$root/.decisions/INDEX.md` (`- [<id>](<id>.md) accepted | <decision> | paths: <...> | interfaces: <...>`). A superseded record: set its `status` to `superseded by <new id>` in the file and in `INDEX.md`; never delete it. Then `ctx sync --quiet`.

**Plan summary.** Written once, after `/aether-wfl:preflight` is clean at HEAD and before `status: done` (the Implementer rules point here), so it records what ships, including fixes preflight caused, rather than what was planned. One per plan: `$root/.decisions/<YYYY-MM-DD>-<slug>-summary.md`, at most ~20 lines of body. Keep only what a later reader can't get from the code, the PR or a decision record; leave out anything an `A` record already says.

```markdown
---
id: <YYYY-MM-DD>-<slug>-summary
kind: summary
date: <YYYY-MM-DD>
feature: <plan title> (<branch>, plan <plan slug>)
at: <HEAD short sha when preflight was clean>
paths: [<same rules as decision records, from the final diff>]
interfaces: [<...>]
decisions: [<ids of this plan's decision records, or empty>]
---
# <plan title>

- Intent: <1-2 sentences>. Non-goals: <list>.
- Rejected in review: <item: what was proposed, why it was rejected, what replaced it> (from `reject:` and `change:` rows and the Review log; omit trivial wording changes)
- Security deferred or accepted: <S id: finding, decision, reason> (or "none")
- Slicing: <why it was cut this way, if not obvious>
- Deviations: <where the shipped diff differs from the approved plan and why> (or "none")
- Open: <DoD items not met or not verified, follow-ups> (or "none")
```

Add one line to `INDEX.md`: `- [<id>](<id>.md) summary | <what shipped, in one line> | watch: <deferred or accepted security, open items a later change could trip on; or "nothing open"> | paths: <...> | interfaces: <...>`. The line alone must tell a reader whether to open the file, so not the plan title. Shorten long interface lists in the line (`env LL_DB_* (4)`); the file keeps them in full. A branch abandoned after the summary was written: set the line to `summary (abandoned)` rather than deleting it.

## 12. Implement

You (the session that approved the plan) coordinate and do nothing heavy yourself: you dispatch workers, talk to the user, commit the waves and sequence the steps. Workers implement, check, fix, review and verify, each a fresh general-purpose subagent with an explicit `model`, and each returns a short summary (at most ~10 lines; the preflight worker returns its report). No worker writes a report file. Subagents cannot start subagents, so every worker below is started by you. A worker prompt is its role text below plus facts (paths, IDs, shas, the slices running in parallel, findings verbatim); never add design or implementation guidance of your own. What the plan does not settle is the worker's to report, not yours to decide. Every worker prompt ends with: "Run one plain command per Bash call from the repo root: no `cd`, `;`, `&&` or `echo $?`."

Group the slices into waves: a wave holds slices whose `Depends on` are all in earlier waves; slices in one wave that share a file move to a later wave. Ask once: "Implement now? Waves: 1: L1, L3 · 2: L2 · … One commit per wave on `<branch>`, then a drift and full-suite check, then preflight until no must-fix (at most 3 preflight runs). When you review and say done: DoD checks, plan summary, `status: done`. I stop for: <the gates below that apply>." Give no other options to pick from.

**No**: end with how to do it later: `/aether-wfl:plan-change <plan path>` and say "implement". Stop.

**Gates.** These stop the run until the user answers. Only you ask the user; never decide one yourself or work around one. Record each as one line in the plan's `Review log`: what was asked and the user's answer.
- the current branch is the repo's default branch or the plan's base branch (before the first commit);
- a worker reports the plan is wrong, or needs a file outside Allowed files, a changed test expectation or a new dependency: stop launching slices; once the plan is amended and re-approved (step 11), or the user rejects the deviation, continue with the remaining slices;
- the final check finds drift or a red suite;
- preflight findings that are not auto-fixable;
- the third preflight run still finds must-fixes;
- every `manual:` DoD item, and any DoD item not met.

**Yes**:
1. The working tree must be clean apart from `.plans/`; otherwise stop and ask the user to commit or set their changes aside first. Check the branch gate. Set `status: implementing`.
2. **Wave.** Launch one Sonnet worker per slice of the wave in a single message: "Implement slice <ID> of `<plan path>`. Follow its Implementer rules for a dispatched slice. Running in parallel: <other slices and their Files>."
3. **Commit the wave.** Stage by name (never `git add -A`) the files the wave's workers report changing that are in their slice's `Files`, and commit with a short message saying what the wave delivers, not the slice IDs, following the repo's commit conventions and the user's attribution rules; never push. Leave anything else uncommitted; the final check reports it. Next wave from 2.
4. **Final check.** After the last wave, one Sonnet worker, role *final check* (below), with every slice and its `Files`. Drift or a red suite is a gate.
5. **Preflight loop.** One Opus worker, role *preflight*. Relay its report to the user. Its auto-fixable must-fixes go to one Sonnet worker with the findings verbatim: "Fix these preflight findings in `<plan path>`'s change. Follow its Implementer rules for dispatched fixes." Ask the user about each other must-fix, with the worker's evidence, and act on their answer. Then preflight again. At most 3 preflight runs (so at most 2 fix rounds): must-fixes in the third are a gate.
6. **Review.** No must-fix left: tell the user the HEAD, the should-fix and nice-to-have counts, and that you wait for their review. Stop until they say done; changes they ask for go through a fix worker and another preflight round.
7. **Finish**, when the user says done. Ask the user to run each `manual:` DoD item at HEAD (give the steps from the plan) and wait. Then one Sonnet worker, role *DoD*, with the manual results and the clean preflight round as evidence for the `/aether-wfl:preflight` item. Re-run one or two of its cheap checks yourself; a mismatch or an item not met is a gate. All met: update the decision records' `paths` and `interfaces` (and their `INDEX.md` lines) to the final diff, write the plan summary and its `INDEX.md` line, `ctx sync --quiet` from the repo root, and set `status: done`. Tell the user what is open.

**Worker roles.** Put the role's instructions in its prompt; a worker reads the plan, not this skill.
- *Final check* (`model: sonnet`): run `git status --porcelain` and `git diff --name-only <plan base sha>..HEAD`. Every new, changed or committed file must belong to one of the given slices' `Files`; `.plans/` is ignored. Run the repo's full typecheck, lint and test suite. Commit nothing. Return pass, or the drift and failing output.
- *Preflight* (`model: opus`): "Act as `/aether-wfl:preflight` for this change. Read `${CLAUDE_SKILL_DIR}/../preflight/SKILL.md` and `${CLAUDE_SKILL_DIR}/../preflight/reviewer.md`. Do SKILL.md steps 1-2 with base `<plan base sha>` and spec `<plan path>`, then do the review in reviewer.md yourself instead of dispatching it. The Done report is filled after preflight, so skip reviewer.md check 12." Return the report, with the must-fix findings in two lists: *auto-fixable* (Breaks findings other than Safety and Weakened test) and *needs the user* (everything else: Security, Spec and Drift, Weakened test, Fit, anything needing a plan change, a test change or a new dependency), each with file:line and one line of evidence; plus the counts of should-fix and nice-to-have.
- *DoD* (`model: sonnet`): "Run every Definition of done check in `<plan path>` at HEAD `<sha>` and fill in its Done report, following its Implementer rules on evidence. Manual items, as reported by the user: <results>. `/aether-wfl:preflight` item: <clean round, HEAD and counts>." Return the status per item.
