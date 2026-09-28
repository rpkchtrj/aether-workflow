# Personal AI-Assisted Engineering Workflow

A portable, risk-based engineering workflow for using agentic AI as a force multiplier **without outsourcing engineering judgment**.

This is intentionally a **global personal workflow**, not a repository convention and not a team process. Install it once on your machine and use it across every codebase you work on. Your teammates can use completely different workflows.

The repository contains portable Agent Skills plus host adapters. The skills themselves are agent-agnostic: Claude Code, OpenAI Codex and any agent that discovers `SKILL.md` directories are supported today, and adding another is a config file rather than a code change.

All skills are namespaced under `aether-wfl`, so they never collide with unrelated skills you have installed.

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

Do not add these skills to each application repository unless you specifically want to. They install at user scope and load across all your projects. This repository is the source distribution; the installer emits the skills into whichever agent you target.

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

Class is a routing decision, not a label. It determines which gates run. If the class is uncertain, the orchestrator picks the higher-risk one.

| Class | Meaning | Typical route |
|---|---|---|
| **T0** | Trivial; no meaningful behavior/security/contract/operational impact | Intent -> minimal verification -> done |
| **T1** | Local low-risk behavior with no material boundary or downstream impact | Requirements/challenge -> security check -> implementation -> verification -> review if useful |
| **T2** | Meaningful behavior, API/state/persistence/concurrency/observability/performance or downstream effect | Requirements -> security -> design challenge -> decision -> implementation -> verification -> adversarial/review -> docs as needed |
| **T3** | Critical security/data/distributed/coordination/external-side-effect/migration/incident/high-blast-radius change | Full workflow: requirements -> security -> design -> trace when applicable -> human decision/ADR -> implementation -> verification -> adversarial tracks -> review -> docs -> final approval |

Security is not a class. It is an always-on lens. A T1 change becomes T2/T3 when its real effect crosses a trust boundary, affects authorization, touches sensitive data, changes resource limits, introduces an external side effect, or invalidates an important security assumption.

Every gate is explicitly reported as `REQUIRED`, `N/A WITH REASON`, or `OPTIONAL WITH REASON`; the orchestrator does not silently omit important concerns.

## Skills

Listed below by their canonical (portable) names. The name you actually type depends on the host - see [Agent support and naming](#agent-support-and-naming). On Claude Code, `engineering-guide` is invoked as `/aether-wfl:engineering-guide`.

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

The adapter writes Claude Code's native skill `model` frontmatter at install time. That field is a Claude Code extension, so it is emitted only for Claude hosts and never reaches an agent that would not understand it; the underlying skill body remains portable.

Because the Claude plugin is generated on your machine at install time rather than shipped pre-built, `models.yaml` stays editable per machine - change it and re-run `install`.

## Install

No clone required. With Node.js 18+ installed:

```bash
npx aether-workflow@latest install
```

Then start a new Claude Code session and run `/aether-wfl:engineering-guide status`.

The installer:

1. emits the portable skills for the selected host, namespaced under `aether-wfl` (by default a Claude Code plugin generated at `~/.engineering-workflow/plugin/` and registered with the `claude` CLI);
2. injects Claude-specific model mappings and explicit-invocation controls from `hosts/claude/models.yaml`;
3. installs the global engineering contract under `~/.engineering-workflow/`;
4. adds a user-level import to `~/.claude/CLAUDE.md` without changing any target repository;
5. installs helper scripts for private project state.

The installer backs up an existing `~/.claude/CLAUDE.md` before modifying it. Nothing is written into any application repository.

To see exactly what would be touched before committing to it:

```bash
npx aether-workflow@latest install --dry-run
```

### Choose a host

```bash
npx aether-workflow hosts                                  # list adapters
npx aether-workflow install --host codex
npx aether-workflow install --host generic --target <dir>
```

If the `claude` CLI is not on `PATH`, the default host cannot register its generated plugin. The installer reports that and you fall back with `--host claude-flat`.

### Upgrade

Re-run the install command. It is idempotent: skills are re-emitted against the current model mapping, and the `CLAUDE.md` import is added only if missing.

```bash
npx aether-workflow@latest install
```

Upgrading from before 1.3.0 also removes the old unprefixed skills from `~/.claude/skills/`, so the two layouts never coexist. Unrelated skills sharing that directory are left untouched, and `verify` fails loudly if a duplicate is ever left behind.

### Verify

```bash
npx aether-workflow verify
```

`verify` checks the host recorded by the last install: that every skill is present under the name that host publishes it as, that the frontmatter `name` matches its directory, and that no host received a frontmatter key it does not understand.

### Remove

```bash
npx aether-workflow uninstall
```

Uninstall removes the workflow-managed global skills and integration files. It does not delete your private project-state directory without an explicit `--purge-state`.

### Working from a clone

Contributors who clone the repository can run the same commands locally:

```bash
node bin/aether.js install --dry-run
npm test
```

`./install.sh` still works and forwards to the Node installer, but it is deprecated.

## Agent support and naming

The workflow is agent-agnostic. `skills/` is the single portable source; a host adapter (`hosts/<name>/host.yaml`) decides how it is emitted.

| Host | Install | Invocation |
|---|---|---|
| Claude Code (default) | `install` | `/aether-wfl:engineering-guide` |
| Claude Code, no plugin loader | `install --host claude-flat` | `/aether-wfl-engineering-guide` |
| OpenAI Codex | `install --host codex` | `$aether-wfl-engineering-guide` |
| Any `SKILL.md` agent | `install --host generic --target <dir>` | host-specific |

There is no cross-agent convention for namespacing skills. The colon form is Claude Code deriving a namespace from a plugin manifest name; it is not something other agents implement. Codex, for example, has its own plugin format but still references skills by their bare `name`.

So the prefix is applied by whichever mechanism the host actually has:

| `namespace` | Host provides | Emitted skill name |
|---|---|---|
| `plugin` | a namespace from the plugin manifest | canonical (`engineering-guide`) |
| `name-prefix` | one flat namespace | prefixed (`aether-wfl-engineering-guide`) |

Either way the `aether-wfl` namespace is present, and it is never doubled. Adding an agent means writing `hosts/<name>/host.yaml` - see [`hosts/README.md`](hosts/README.md).

## Daily usage

At the start of work:

```text
/aether-wfl:engineering-guide resume
```

For a new meaningful change:

```text
/aether-wfl:engineering-orchestrator
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
/aether-wfl:engineering-guide sync-check
```

If material drift is found, invoke:

```text
/aether-wfl:documentation-guardian
```

The guardian shows proposed changes first and waits for `GO`.

## The critical rule

**Do not confuse AI-generated code that works with an engineering system you understand and can defend.**

This workflow is deliberately designed so that AI reduces typing and increases challenge capacity without reducing human engineering reasoning.

## Host portability

The core `skills/*/SKILL.md` files follow the open Agent Skills approach as much as possible and contain no host-specific frontmatter. Each adapter declares an allowlist of the keys its host understands, and the installer rebuilds frontmatter from that list — so Claude Code's `model` and `disable-model-invocation` extensions are emitted for Claude hosts and never reach one that would choke on them.

Where a host has no namespace of its own, the emitter also rewrites references between skills, so a prefixed install never points at a name that does not exist on that host.

Adding a host adapter maps the same skill profiles and invocation policies onto new tooling without changing the engineering rules, and without changing `lib/`.

## Source references

Claude Code Skills: https://code.claude.com/docs/en/skills
Claude Code plugins and marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
Claude Code memory / user-level CLAUDE.md: https://code.claude.com/docs/en/memory
Codex skills: https://learn.chatgpt.com/docs/build-skills
Agent Skills: https://agentskills.io/
