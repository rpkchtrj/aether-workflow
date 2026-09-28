# Personal AI-Assisted Engineering Workflow

A portable, risk-based engineering workflow for using agentic AI as a force multiplier **without outsourcing engineering judgment**.

This is intentionally a **global personal workflow**, not a repository convention and not a team process. Install it once on your machine and use it across every codebase you work on. Your teammates can use completely different workflows.

The repository contains portable Agent Skills plus host adapters. The skills themselves are agent-agnostic: Claude Code, OpenAI Codex and any agent that discovers `SKILL.md` directories are supported today, and adding another is a config file rather than a code change.

All skills are namespaced under `aether-wfl`, so they never collide with unrelated skills you have installed.

## Core operating model

```text
Human intent
  -> select or start a change
  -> change classification
  -> security impact check
  -> documentation impact check
  -> human-owned requirements
  -> human-stated design, threat model, trace model
  -> AI challenge of each
  -> human decision
  -> explicit GO
  -> AI implementation
  -> machine verification
  -> adversarial/security/distributed/tracing/performance/chaos checks as applicable
  -> independent review
  -> reasoning defense
  -> documentation reconciliation
  -> human final approval
```

AI may analyze, challenge, implement, verify, attack assumptions, investigate incidents, and reconcile factual documentation. **The human owns requirements, invariants, correctness semantics, architecture, security decisions, trade-offs, acceptance criteria, and final approval.**

`engineering-orchestrator` is the control plane and the only skill you talk to. It dispatches every other skill from a fixed routing table and stops only at enumerated stop points, so you spend turns on decisions rather than on typing skill names. Dispatch is not autonomy: choosing the next skill is mechanical, and every judgment stays yours.

**[WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) walks one change of each class, T0 through T3, end to end** — what the orchestrator does, where it stops, and what it wants from you at each stop. Start there if you want to see the workflow rather than read its rules.

## Why this is global

Do not add these skills to each application repository unless you specifically want to. They install at user scope and load across all your projects. This repository is the source distribution; the installer emits the skills into whichever agent you target.

Your target repositories should contain only their normal team/project artifacts. A shared `CLAUDE.md` may remain in Git for team instructions. Your personal workflow contract is installed at user scope and is not part of the project repository.

## Private workflow state - never required in Git

The workflow keeps your personal engineering state outside each target repository:

```text
~/.engineering-workflow/
  projects/
    <project-id>/
      PROJECT.md
      CHANGES.md          # index of every change; read at session start
      WORK_LOG.md
      changes/
        <change-id>/
          STATE.md        # class, gate matrix, stage ledger, provenance
          requirements/
          decisions/
          architecture/
          security/
          tracing/
          performance/
      incidents/
```

State is scoped to a **change**, not to a project, because you keep several open at once and each spans many sessions. At session start the orchestrator lists what is in progress and asks which one — it never picks for you, even when only one change is open, and never assumes a new request belongs to an in-progress change.

Each `STATE.md` carries an append-only stage ledger recording the `base_sha` and change surface at every entry. On resume those are compared against the current tree: anything that moved marks its gates `STALE — RE-VERIFY`. A ledger entry records what was observed then, not what is true now.

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

## Implementation discipline

`implementation-agent` does not start from a flat list of files it intends to touch. Before the first write it declares the change by structural impact - new files, new modules, additive edits to existing modules, and modifying edits to existing modules - with known callers listed for anything it intends to modify. That declaration is what you approve with `GO`.

Anything whose contract, signature, invariant, failure behavior or data shape is consumed outside the approved scope is treated as **shared surface**. The agent does not change shared surface on its own: it stops, reports the symbol, its callers and the compatibility options, and waits for your instruction. Adding a new symbol to a shared module is not shared surface.

Abstraction is not the default. Concrete implementation is the baseline, and a single-implementation interface that protects no real seam is treated as unrequested scope rather than good practice. The agent raises an interface decision only where something actually signals plurality - a component named for a category, an existing sibling, a requirement that hedges with `for now`, a config or feature-flag switch, or a wrapped external provider - and it surfaces the decision **either way**, including when it has decided against an interface. That is deliberate: you may know about planned implementations that are nowhere in the repository, and an assumption you can see is an assumption you can correct. Where nothing signals plurality, it writes the concrete code and says nothing.

This rides on the same `GO` as the change plan. It is not an extra approval round.

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

## How a gate is allowed to disappear

`N/A WITH REASON` is the weak point of any gate matrix. The judgment is model-side, the label looks identical whether it was right or wrong, and prose like "no security boundary" cannot be contradicted by anything. Four constraints narrow it:

**Gates start `REQUIRED` and are downgraded by an explicit act.** The matrix is never composed from scratch — a gate nobody considered and a gate deliberately dropped look the same once the row is missing.

**Class floors.** At T3, security, senior review and engineering reasoning cannot be downgraded; at T2 and above, neither can verification or documentation impact. If a floored gate looks inapplicable, the classification was wrong, not the gate.

**Downgrade reasons must be falsifiable.** Not "no security boundary" but "change surface is `src/billing/format.ts` only; imports no `net/`, `db/`, `auth/` or `queue/` module" — a claim that can turn out to be false. Tripwires check it mechanically against the change surface, and a fired tripwire forces the gate back to `REQUIRED` *without asking you*. Prompting on each would hand you a list of negatives to approve, which is how rubber-stamping starts. Model judgment may add a gate; it may never remove one against evidence.

**The matrix is re-evaluated when evidence exists.** It is first decided off a sentence of description, when the least is known. Tripwires re-run at S8 against the declared change surface, and again against the real diff. A gate reopened at S8 costs one dispatch; one wrongly closed at classification costs an incident.

### What this does not catch

Tripwires read structure, not meaning. A change can touch a security boundary semantically while importing nothing suspicious — an off-by-one in a tenant-id comparison, sitting in a file with no security-shaped imports, reachable only through a call chain the tripwire never inspects. Nothing fires. The matrix reports `N/A WITH REASON` against a reason that is *technically true and substantively wrong*.

The constraints above shrink silent skips to cases that need semantic understanding to spot, and put a hard floor under the ones where being wrong is worst. They do not eliminate the class, and a clean gate matrix is not proof of completeness. That residue is precisely what S10, the reasoning defense, exists to catch — it asks what your change does, not what it imports.

## Skills

Listed below by their canonical (portable) names. **You invoke only `engineering-orchestrator`** — on Claude Code, `/aether-wfl:engineering-orchestrator`. It is also the one skill the model may reach for on its own when you describe a change. Everything else is dispatched by its routing table, never by description matching: a gate that fired probabilistically could not be told apart from a gate that was skipped.

See [Agent support and naming](#agent-support-and-naming) for how names map per host.

### Control plane
`engineering-orchestrator` — the only entry point

### Core reasoning and routing
`requirements-architect`, `system-design-challenger`, `engineering-guide`, `engineering-reasoning-reviewer`

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

Change the mapping for your machine in `~/.engineering-workflow/config.yaml` (`model_strategic: haiku`); it outranks the packaged `hosts/claude/models.yaml` and survives upgrades. Do not rewrite every skill when models change. The source skills also show their model profile in a `## Model` section.

The adapter writes Claude Code's native skill `model` frontmatter at install time. That field is a Claude Code extension, so it is emitted only for Claude hosts and never reaches an agent that would not understand it; the underlying skill body remains portable.

The copy of `models.yaml` under the workflow home is a reference of what the package ships: seeded once, then left alone. Set overrides in `config.yaml` instead - see below.

## Tweaking the workflow

The workflow is opinionated on purpose, but it is yours. Two files under `~/.engineering-workflow/` are user-owned: an install seeds them once if they are missing and never writes over them again, so a local tweak survives an upgrade.

**`config.yaml`** - flat `key: value`.

```yaml
model_strategic: haiku
model_implementation: sonnet
```

**`overrides/<skill>.md`** - markdown appended to that skill as a `## Local overrides` section at install time.

```text
~/.engineering-workflow/overrides/verification-engineer.md

  ## House rules
  Always run `npm run lint` alongside the tests and report both.
  Flaky tests are quarantined with an issue link, never deleted.
```

This is additive layering, not a semantic merge. Prose cannot be combined automatically, so your text follows the base rules rather than being woven into them, and the base rules stay in force.

### When your tweak and an upgrade disagree

An install reports rather than guesses. An override is **refused, and the base skill installed unchanged**, when it:

- names a skill that does not ship in this version (renamed or removed upstream)
- contains a frontmatter fence
- sets a model or invocation key
- reads as waiving S2, S8, S10 or S12
- reads as downgrading a class-floored gate
- instructs the agent to ignore a base rule rather than add to it

```text
OVERLAY CONFLICTS - 2 override(s) NOT applied:
  senior-code-reviewer: appears to waive S2, S8, S10 or S12, which are unwaivable above T0
  typo-skill: no skill named "typo-skill" ships in this version; it may have been renamed or removed
  The base skills were installed unchanged. Reconcile these yourself,
  then re-run install.
```

Separately, `.reconciled.json` records the base skill each override was last reconciled against. When an upgrade changes that skill, the install says so and applies the override anyway - drift is a prompt to re-read your addition, not a refusal:

```text
OVERLAY WARNINGS - applied, but worth a look:
  verification-engineer: the base skill changed in this version; re-read your override against it
```

Those refusal checks are literal pattern matches. They catch the obvious contradictions; an override can still disagree with the base in prose no pattern will recognise, which is why every applied override is named in the install output rather than applied quietly.

## Install

No clone required. With Node.js 18+ installed:

```bash
npx aether-workflow@latest install
```

Then start a new Claude Code session and run `/aether-wfl:engineering-guide status`.

The installer:

1. emits the portable skills for the selected host, namespaced under `aether-wfl` (by default a Claude Code plugin generated at `~/.engineering-workflow/plugin/` and registered with the `claude` CLI);
2. injects Claude-specific model mappings from `hosts/claude/models.yaml` and the per-skill invocation gate each skill declares in its own frontmatter;
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

Describe what you want, or open the orchestrator directly:

```text
/aether-wfl:engineering-orchestrator
```

It lists the changes in progress and asks which one this session is about, or whether to start a new one. From there it classifies the change, presents the gate matrix, and dispatches the route — streaming each skill's output in full as it completes, and stopping only where a decision is owed to you.

The stop points are a closed set. A stop not on the table is not a stop; a stop on the table that applies is mandatory and is recorded with your verbatim response.

| ID | Stop | You supply |
|---|---|---|
| S1 | Intent and scope | what is being built and why |
| S2 | Requirements | business/functional requirements, authored by you |
| S3 | NFR disposition | accept / reject / defer each proposed non-functional requirement |
| S4 | Design statement | components, ownership, contracts, state, failure behavior |
| S5 | Threat model | assets, actors, trust boundaries, abuse cases |
| S6 | Trace model | logical operations, causal boundaries |
| S7 | Design decision / ADR | resolve challenges; dispose of proposed alternatives |
| S8 | Pre-write GO | approve the declared change surface |
| S9 | Stop-ship finding | fix / accept risk / abandon |
| S10 | Reasoning defense | answers from your own understanding |
| S11 | Documentation write GO | approve the proposed diff |
| S12 | Final approval | ship / do not ship |

**S2, S8, S10, and S12 are never waived above T0.** You state the requirements, authorize the write, defend the change, and approve the ship. Everything else is risk-proportional.

For a T0/T1 change the route is intentionally shorter, but security impact and downstream side effects are still checked first.

See [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) for a worked example of each class.

### When you do not have the model ready

The adversarial skills are built on *you state the model, AI attacks it* — `system-design-challenger` reviews your design, `security-adversary` starts from your threat model. On an unfamiliar subsystem you may not have one, which is normal rather than a failure. The orchestrator escalates along a fixed ladder, and every rung is recorded:

| Rung | Form | Result is tagged |
|---|---|---|
| 1 | Open question, no hypothesis | `human` |
| 2 | Directed probe containing a hypothesis | `ai-prompted` |
| 3 | Named gaps, no content | `ai-prompted` |
| 4 | Explicit candidate with trade-offs | `ai-proposed`, needs disposition |

Business and functional requirements are limited to rungs 1 and 3 — a proposed requirement put in front of a busy engineer gets accepted, which makes proposing it the same as deciding it. Everything else may use all four rungs.

At S10 the reasoning reviewer targets `ai-proposed` and `ai-prompted` elements hardest, because those are what you are least able to defend cold. That is what makes leaning on rung 4 safe rather than merely fast.

## Markdown only

Every artifact this workflow produces is markdown — in conversation, or a `.md` file in the repository or under the workflow home. Never a document connector, artifact, canvas, or other host-rendered surface, whatever the length. Markdown is diffable, greppable, reviewable a year later, and outlives the tool that wrote it.

## Branch sync

A pull, rebase, or merge from staging/prod/release is new change input. The orchestrator detects it on resume via the recorded `base_sha`, marks the affected gates `STALE — RE-VERIFY`, and re-runs them before continuing. If material documentation drift is found, `documentation-guardian` shows proposed changes first and waits for `GO`.

## The critical rule

**Do not confuse AI-generated code that works with an engineering system you understand and can defend.**

This workflow is deliberately designed so that AI reduces typing and increases challenge capacity without reducing human engineering reasoning. Dispatch removes the typing between gates; it removes no gate. The faster a change arrives, the less of it has been internalised — which is why S10 is the one stage that gets harder as everything else gets faster.

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
