# Private State Layout

The workflow intentionally keeps its personal engineering artifacts outside target repositories.

```text
~/.engineering-workflow/
  config.yaml
  bin/
  hosts/
    claude/
  projects/
    <project-id>/
      PROJECT.md
      WORKFLOW_STATE.md
      WORK_LOG.md
      requirements/
      decisions/
      architecture/
      security/
      tracing/
      incidents/
      performance/
```

## Project identity

Prefer the stable Git remote URL as the project identity when available. Fall back to the normalized repository root path when a remote is unavailable.

## Authority

Private state is personal context/continuity. It never outranks current code, tests, runtime evidence, team contracts, or approved shared decisions.
