# Personal AI-Assisted Engineering Workflow

A portable, risk-based engineering workflow for using agentic AI as a force multiplier **without outsourcing engineering judgment**.

This is intentionally a **global personal workflow**, not a repository convention and not a team process. Install it once on your machine and use it across every codebase you work on. Your teammates can use completely different workflows.

The repository contains portable Agent Skills plus host adapters. The default adapter today is Claude Code; future adapters can map the same skills to other agentic tools and their models.

## Core operating model

```text
Human intent
  -> change classification
  -> security impact check
  -> documentation impact check
  -> human-owned requirements
  -> AI challenge
  -> human decision
  -> explicit GO
  -> AI implementation
  -> machine verification
  -> adversarial/security/distributed/tracing/performance/chaos checks as applicable
  -> independent review
  -> documentation reconciliation
  -> human final approval
```

AI may analyze, challenge, implement, verify, attack assumptions, investigate incidents, and reconcile factual documentation. **The human owns requirements, invariants, correctness semantics, architecture, security decisions, trade-offs, acceptance criteria, and final approval.**

## Why this is global

Do not add these skills to each application repository unless you specifically want to. Claude Code supports personal skills under `~/.claude/skills/`, which load across your projects. This repository is the source distribution; the installer places the skills into your personal Claude Code skill directory.

Your target repositories should contain only their normal team/project artifacts. A shared `CLAUDE.md` may remain in Git for team instructions. Your personal workflow contract is installed at user scope and is not part of the project repository.

## Private workflow state - never required in Git

The workflow keeps your personal engineering state outside each target repository:

```text
~/.engineering-workflow/
  projects/
    <project-id>/
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

This means you can maintain private requirements, decision records, architecture notes, security reasoning, incident notes, and workflow continuity without asking the team to adopt them.

The repository/codebase remains the reality. Private state is a memory and reasoning aid. If your notes disagree with the actual code, tests, production evidence, or team-approved contract, the disagreement is surfaced rather than hidden.

## Documentation philosophy

The workflow deliberately avoids a giant documentation burden. Tiny self-contained changes with no durable downstream effect do not create documentation. A small refactor **does** get flagged when it changes an important assumption elsewhere.

`documentation-guardian` watches for drift during meaningful work and after syncing from staging/prod/release. It is review-first: it shows the proposed documentation changes and waits for explicit human `GO` before writing anything.

It distinguishes between:

- **private workflow artifacts** that belong only to you; and
- **team/shared repository documentation** that already exists or that you explicitly choose to change.

## Security is always-on

The workflow is risk-based, not security-optional. Every meaningful change gets a security-impact check. A security gate may be marked `N/A WITH REASON` only when there is concrete evidence that the change cannot affect security boundaries, inputs, privileges, secrets, resource limits, data handling, or external effects.

A small change that creates a security concern elsewhere must be escalated.

## Change classes

- **T0** - truly trivial/mechanical, no behavior or material side effect.
- **T1** - localized low-risk behavior.
- **T2** - meaningful behavior/API/state/persistence/concurrency/observability/performance change.
- **T3** - critical security, migrations, distributed coordination, external side effects, incidents, high-risk performance, or broad blast radius.

Every gate is explicitly reported as `REQUIRED`, `N/A WITH REASON`, or `OPTIONAL WITH REASON`; the orchestrator does not silently omit important concerns.

## Skills

### Core reasoning and routing
`engineering-orchestrator`, `requirements-architect`, `system-design-challenger`, `engineering-guide`, `engineering-reasoning-reviewer`

### Implementation and verification
`implementation-agent`, `runtime-engineer`, `verification-engineer`, `senior-code-reviewer`

### Adversarial / reliability
`distributed-adversary`, `security-adversary`, `chaos-engineer`, `ai-incident-commander`, `performance-engineer`, `distributed-tracing-engineer`

### Documentation
`documentation-guardian`

## Model profiles

Skills declare a portable `model_profile` rather than a vendor-specific model ID. The Claude adapter currently maps:

| Profile | Claude Code default | Use |
|---|---|---|
| `strategic` | `opus` | planning, requirements, architecture, security, distributed reasoning, incident diagnosis, senior review |
| `implementation` | `sonnet` | coding, routine verification, runtime-focused implementation, controlled experiments |

Change the Claude mapping centrally in `hosts/claude/models.yaml`; do not rewrite every skill when models change. The source skills also show their model profile in a `## Model` section.

The adapter uses Claude Code's native skill `model` frontmatter at install time. That field is a Claude Code extension; the underlying skill body remains portable.

## Install for Claude Code

Clone this repository, then run:

```bash
./install.sh
```

The installer:

1. installs the portable skills into `~/.claude/skills/`;
2. injects Claude-specific model mappings and explicit-invocation controls from `hosts/claude/`;
3. installs the global engineering contract under `~/.engineering-workflow/`;
4. adds a user-level import to `~/.claude/CLAUDE.md` without changing any target repository;
5. installs helper scripts for private project state.

The installer backs up an existing `~/.claude/CLAUDE.md` before modifying it.

### Verify

```bash
./scripts/verify-install.sh
```

### Remove

```bash
./scripts/uninstall.sh
```

Uninstall removes the workflow-managed global skills and integration files. It does not delete your private project-state directory without an explicit `--purge-state`.

## Daily usage

At the start of work:

```text
/engineering-guide resume
```

For a new meaningful change:

```text
/engineering-orchestrator
```

The orchestrator first classifies the change and presents the gate matrix. For meaningful work, the normal sequence is:

```text
Human intent
-> Requirements Architect
-> Security pre-flight
-> System Design Challenger
-> Security Adversary
-> Tracing Engineer (when applicable)
-> Human decision / decision record
-> Human GO
-> Implementation Agent
-> Runtime Engineer (when relevant)
-> Verification Engineer
-> Distributed Adversary (when distributed)
-> Security review (when applicable)
-> Trace validation (when applicable)
-> Senior Code Review
-> Engineering Reasoning Review
-> Documentation Guardian
-> Human final approval
```

For a T0/T1 change, the route is intentionally shorter, but security impact and downstream side effects are still checked first.

## Branch sync

After syncing from staging/prod/release, run:

```text
/engineering-guide sync-check
```

If material drift is found, invoke:

```text
/documentation-guardian
```

The guardian shows proposed changes first and waits for `GO`.

## The critical rule

**Do not confuse AI-generated code that works with an engineering system you understand and can defend.**

This workflow is deliberately designed so that AI reduces typing and increases challenge capacity without reducing human engineering reasoning.

## Host portability

The core `skills/*/SKILL.md` files follow the open Agent Skills approach as much as possible. Claude Code has extra frontmatter/features; those are kept under `hosts/claude/`. A future Codex or other host adapter can map the same skill profiles and invocation policies to its own model/tooling without changing the engineering rules.

## Source references

Claude Code Skills: https://code.claude.com/docs/en/skills
Claude Code memory / user-level CLAUDE.md: https://code.claude.com/docs/en/memory
Agent Skills: https://agentskills.io/
