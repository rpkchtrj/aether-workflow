# Private State Layout

The workflow intentionally keeps its personal engineering artifacts outside target repositories. Everything it writes is markdown.

```text
~/.engineering-workflow/
  config.yaml          # user overlay; never overwritten by an install
  overrides/           # per-skill additions; never overwritten
    <skill>.md
    .reconciled.json
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

## User overlay

`config.yaml` and `overrides/` are yours. An install seeds them once if absent and never writes over them again, so a tweak survives an upgrade.

- `config.yaml` — flat `key: value`. `model_strategic` and `model_implementation` override the packaged model mapping for this machine.
- `overrides/<skill>.md` — appended to that skill as a `## Local overrides` section at install time.

`hosts/claude/models.yaml` under the workflow home is a reference copy of what the package ships. It is seeded once and then left alone; actual precedence comes from `config.yaml`.

An override is refused, and the base skill installed unchanged, when it names a skill that does not ship, carries a frontmatter fence, sets a model or invocation key, or reads as waiving a stop point or a class floor. `.reconciled.json` records the base skill each override was last reconciled against, so an upgrade that changes that skill says so rather than relayering silently.

Those checks are literal patterns. They catch the obvious contradictions; an override can still disagree with the base in prose no pattern will recognise, which is why every applied override is named at install rather than applied quietly.

## Project identity

Prefer the stable Git remote URL as the project identity when available. Fall back to the normalized repository root path when a remote is unavailable.

## Authority

Private state is personal context and continuity. It never outranks current code, tests, runtime evidence, team contracts, or approved shared decisions. A completed gate in the ledger is a record of an observation, not a guarantee about the present.
