# Workplace Workflow

This workflow is a **personal global process**. It does not assume teammates follow it. Target repositories can remain exactly as the team maintains them.

## Operating sequence

```text
Human intent
  -> classify risk
  -> security impact check
  -> documentation impact check
  -> human-owned requirements
  -> AI challenge
  -> human decision
  -> explicit GO
  -> implementation
  -> verification
  -> adversarial tracks as applicable
  -> independent review
  -> proposed documentation reconciliation
  -> human final approval
  -> private state update
```

## Gate matrix

Every meaningful change gets an explicit matrix. Each concern is one of:

- `REQUIRED`
- `N/A WITH REASON`
- `OPTIONAL WITH REASON`

The workflow is risk-based, but never silently incomplete.

## Human authority

AI does not own requirements, invariants, correctness semantics, architecture, security acceptance, trade-offs, or final approval. Skill invocation is not write authorization. Before the first material write, the agent shows the intended change, affected files, risks, and verification plan, then waits for `GO`.

## Security

Security is considered on every meaningful change. If a seemingly tiny change can affect an authorization boundary, sensitive data, external side effect, resource limit, input validation, secret handling, or trust assumption elsewhere, the change escalates.

## Distributed behavior

Distributed/adversarial checks are required when the system actually crosses process, network, asynchronous, or durable coordination boundaries. They are not forced into a purely local change.

## Documentation

The workflow never requires a `docs/` directory in the target repository. Private workflow state lives outside Git. Existing team docs are read as team/shared artifacts. `documentation-guardian` identifies drift in both private notes and shared docs, but writes only after explicit human GO.

## Branch sync

A pull/rebase/merge from staging/prod/release is treated as new change input. Re-check assumptions and documentation before resuming work.
