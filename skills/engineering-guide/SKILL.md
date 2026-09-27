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

Core private artifacts:
- `WORKFLOW_STATE.md` - compact current state and gate matrix.
- `WORK_LOG.md` - append-only personal history.
- `requirements/` - human-approved requirement artifacts when durable capture is needed.
- `decisions/` - private engineering decision records; team ADRs in the repository remain separate.
- `security/`, `tracing/`, `incidents/`, `performance/` - create only when material and useful.

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

## Intents
`status`: current change, class, stage, gates, blockers, next skill.
`resume`: read private state + latest work log and produce a handoff.
`next`: identify next valid skill and required artifact.
`history <change>`: summarize relevant history.
`start <change>`: initialize private state for a change.
`record`: prepare a proposed state/log update; show it before writing unless already authorized.
`complete <stage>`: mark complete only with evidence/approval.
`sync-check`: inspect changes introduced by a branch sync and flag private-model drift.

## Resume card
ACTIVE CHANGE; CURRENT STAGE; CHANGE CLASS; WHAT IS COMPLETE; LAST RESULT; OPEN DECISIONS/BLOCKERS; DOCUMENTATION DRIFT; NEXT SKILL; FILES TO READ FIRST.

## Model
Model profile: `strategic`.
The Claude Code host adapter maps `strategic` to the configured Opus model alias.
