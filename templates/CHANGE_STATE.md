# Change State

Change ID: <change-id>
Title: <short title>
Project: <project-id>
Repository root: <path>
Branch: <branch>
Base SHA at last entry: <sha>
Class: <T0|T1|T2|T3>
Status: <IN_PROGRESS|BLOCKED|COMPLETE>
Last updated: <YYYY-MM-DD HH:MM>

## Gate Matrix
Every row starts REQUIRED. Downgrading to N/A WITH REASON or OPTIONAL WITH
REASON is an explicit act, never an omission — do not delete a row, and do not
build this list from scratch. A gate nobody considered and a gate deliberately
dropped must not look the same.

A downgrade reason must be falsifiable: a claim about this repository that could
turn out to be false, not an opinion. "No security boundary" is not a reason.
"Change surface is src/billing/format.ts only; imports no net/, db/, auth/ or
queue/ module" is.

| Gate | Label | Disposition | Falsifiable reason (if downgraded) | Tripwire result |
|---|---|---|---|---|
| Requirements | REQUIRED | NOT RUN | | |
| Security (design) | REQUIRED | NOT RUN | | |
| Design challenge | REQUIRED | NOT RUN | | |
| Tracing (design) | REQUIRED | NOT RUN | | |
| Implementation | REQUIRED | NOT RUN | | |
| Runtime | REQUIRED | NOT RUN | | |
| Verification | REQUIRED | NOT RUN | | |
| Distributed correctness | REQUIRED | NOT RUN | | |
| Security (implementation) | REQUIRED | NOT RUN | | |
| Tracing (validation) | REQUIRED | NOT RUN | | |
| Performance | REQUIRED | NOT RUN | | |
| Chaos | REQUIRED | NOT RUN | | |
| Senior review | REQUIRED | NOT RUN | | |
| Engineering reasoning | REQUIRED | NOT RUN | | |
| Documentation | REQUIRED | NOT RUN | | |

Disposition is one of COMPLETE, STALE — RE-VERIFY, BLOCKED, REOPENED, NOT RUN.

Tripwire result is CLEAR, or FIRED with what it hit. A fired tripwire forces the
gate back to REQUIRED without asking the human.

### Class floors — cannot be downgraded
- T3: Security, Senior review, Engineering reasoning
- T2 and above: Verification, Documentation
- Above T0: stop points S2, S8, S10, S12

If a floored gate looks inapplicable, the classification is wrong, not the gate.

### Re-evaluation points
Tripwires are re-run against the declared change surface at S8, and against the
real diff after implementation. Record reopened gates here rather than leaving
the classification-time judgment standing.

| When | Surface checked | Gates reopened |
|---|---|---|
| Classification | described scope | |
| S8 | declared change surface | |
| Post-implementation | real diff | |

## Stop points answered
Human responses are recorded verbatim. Do not tidy or compress them.

| Stop | Date | Response |
|---|---|---|
| S1 | | |

## Provenance
Requirements, design elements, threat model entries, and trace model entries,
by origin. `ai-prompted` means the human authored it after a directed question
that carried its own hypothesis.

| Element | Origin | Status | Notes |
|---|---|---|---|
| | human / ai-prompted / ai-proposed | accepted / rejected / deferred | |

## Stage ledger
Append-only. One row per dispatched stage. Evidence is what was observed, with
the exact command. Never record an unobserved result as a pass.

| # | Stage | Skill | Gate label | Disposition | Base SHA | Evidence observed |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## Change surface
Files and symbols declared before the first write. Compared against the tree on
resume to detect staleness.

-

## Open decisions / blockers
-

## Next
- Stop: <S1-S12> — <what it needs from the human>
- Skill: <skill-name>
- Read: <files>
