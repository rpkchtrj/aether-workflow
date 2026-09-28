---
name: engineering-guide
description: "Navigation and private-state skill for a personal engineering workflow: shows current change/stage, next skill, blockers, relevant artifacts, history, and safe resume state without requiring project docs to be committed."
metadata:
  workflow_model_profile: strategic
  workflow_invocation: explicit
---
# Engineering Guide

## Mission
Be the navigation layer for the personal engineering workflow without becoming the engineering decision-maker.

## Private state
The workflow state lives outside the target repository under the configured workflow home, normally `~/.engineering-workflow/projects/<project-id>/` (or the host-configured `ENGINEERING_WORKFLOW_HOME`). Do not require a `docs/` folder in the target repository.

State is **per change**, not per project. A developer has several changes open at once and each spans many sessions, so a single current-state file cannot represent the truth.

```text
<project-id>/
  PROJECT.md
  CHANGES.md              # index: one line per change, its state, last touched
  WORK_LOG.md             # append-only, project-wide
  changes/
    <change-id>/
      STATE.md            # class, gate matrix, ledger, provenance, base SHA
      requirements/
      decisions/
      security/
      tracing/
      performance/
  incidents/
```

`<change-id>` is a short stable slug the human recognises months later (`tenant-webhook-callback`), not a timestamp.

Every artifact is markdown. Never a document connector, artifact, or other host-rendered surface.

## Authority boundary
Private state is a reasoning aid and continuity mechanism, not proof of current code correctness. The repository, tests, observed runtime behavior, team-shared contracts, approved team ADRs, and operational evidence outrank stale personal notes.

## Hard Rules
1. Never mark a stage complete without evidence or explicit human confirmation.
2. Never rewrite history; append corrections.
3. Never invent tests, decisions, findings, or completed work.
4. Never treat personal state as proof of correctness.
5. Never advance implementation gates if requirements, security disposition, or decision gates are incomplete.
6. If distributed/asynchronous behavior exists, require the distributed track unless a concrete architecture analysis shows it is genuinely not applicable.
7. Prefer small accurate state updates.
8. When state conflicts with actual artifacts/evidence, report the conflict and stop for human direction.
9. Do not create a private document merely because a skill could create one; use the documentation-importance filter.
10. Before any write to private state, show the proposed change and wait for explicit GO unless the human has already explicitly approved that exact state update.
11. Never select a change on the human's behalf. Report what exists and let them choose, including when only one change is in progress.
12. Never carry a gate forward as complete when the code it was observed against has moved.

## Stage ledger
`STATE.md` carries an append-only ledger, one row per dispatched stage. It exists so that "the orchestrator ran the security pass" is a checkable claim rather than a memory, and so a stage that never ran is visibly absent instead of merely unmentioned.

Each row records:

- stage name and the skill dispatched
- gate label: `REQUIRED` / `N/A WITH REASON` / `OPTIONAL WITH REASON`
- disposition: `COMPLETE` / `STALE — RE-VERIFY` / `BLOCKED` / `NOT RUN`
- stop points hit, with the human's verbatim response
- evidence actually observed (commands and their output), never evidence assumed
- `base_sha` at the time of the entry, and the declared change surface

The last two are what make resume safe. A ledger entry is a record of what was observed then, not a claim about now: on resume, compare `base_sha` and the change surface against the working tree and the base branch, and mark everything affected `STALE — RE-VERIFY`. A merge from staging, production, or release is new change input and invalidates gates that depended on the old code.

## Intents
`list`: every change in the project with class, stage, next stop, last touched, and blocked status. This is what the orchestrator shows at session start; it never picks one.
`status <change>`: that change's class, stage, gates, blockers, next skill.
`resume`: read private state + latest work log and produce a handoff.
`next`: identify next valid skill and required artifact.
`history <change>`: summarize relevant history.
`start <change>`: initialize per-change private state under `changes/<change-id>/` and add it to `CHANGES.md`.
`record`: prepare a proposed state/log update; show it before writing unless already authorized.
`complete <stage>`: mark complete only with evidence/approval.
`sync-check`: inspect changes introduced by a branch sync and flag private-model drift.
`staleness <change>`: compare recorded `base_sha` and change surface against the current tree; report which completed gates are now stale.

## Resume card
SELECTED CHANGE; CURRENT STAGE; CHANGE CLASS; WHAT IS COMPLETE; LAST RESULT; OPEN DECISIONS/BLOCKERS; STALE GATES; DOCUMENTATION DRIFT; NEXT STOP AND WHAT IT NEEDS; NEXT SKILL; FILES TO READ FIRST.

## Model
Model profile: `strategic`.
The Claude Code host adapter maps `strategic` to the configured Opus model alias.
