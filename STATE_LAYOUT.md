# Private State Layout

The workflow intentionally keeps its personal engineering artifacts outside target repositories. Everything it writes is markdown.

```text
~/.engineering-workflow/
  config.yaml
  bin/
  hosts/
    claude/
  projects/
    <project-id>/
      PROJECT.md
      CHANGES.md
      WORK_LOG.md
      changes/
        <change-id>/
          STATE.md
          requirements/
          decisions/
          architecture/
          security/
          tracing/
          performance/
      incidents/
```

## Per-change state

A developer keeps several changes open at once, and one change spans many sessions. State is therefore scoped to a change, not to a project: `CHANGES.md` is the index the orchestrator reads at session start, and each `changes/<change-id>/STATE.md` holds that change's class, gate matrix, stage ledger, and requirement provenance.

`<change-id>` is a short stable slug the human will still recognise months later (`tenant-webhook-callback`), not a timestamp.

The orchestrator never selects a change on the human's behalf. It lists what is in progress and asks, every session, including when only one change is open.

## Stage ledger

`STATE.md` carries an append-only ledger with one row per dispatched stage: the skill, the gate label, the disposition, the stop points hit with the human's verbatim answers, the evidence actually observed, the `base_sha`, and the declared change surface.

The last two exist because a ledger entry records what was true when it was written. On resume, the recorded `base_sha` and change surface are compared against the current tree and base branch; anything that moved marks its dependent gates `STALE — RE-VERIFY`. A merge from staging, production, or release is new change input and invalidates gates observed against the old code.

## Project identity

Prefer the stable Git remote URL as the project identity when available. Fall back to the normalized repository root path when a remote is unavailable.

## Authority

Private state is personal context and continuity. It never outranks current code, tests, runtime evidence, team contracts, or approved shared decisions. A completed gate in the ledger is a record of an observation, not a guarantee about the present.
