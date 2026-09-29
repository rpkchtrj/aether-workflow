# Changelog

## Unreleased

- Fixed: `uninstall` reported `Could not unregister aether-wfl` when no marketplace was registered, which is the end state uninstall wants rather than a failure. The install path already treated an already-added marketplace as idempotent; the uninstall path had no mirror of that check. A missing `claude` CLI is now reported as such instead of surfacing a raw `Command failed`. Added `test/register.test.js` - `lib/register.js` had no coverage.

## 2.0.0

**Breaking:** private state moved to a per-change layout. `WORKFLOW_STATE.md` is replaced by `CHANGES.md` plus `changes/<change-id>/STATE.md`, and `init-project` no longer creates project-level `requirements/`, `decisions/`, `architecture/`, `security/`, `tracing/` or `performance/`. Existing state is not migrated.

**User overlay.** Local tweaks now survive an upgrade. `~/.engineering-workflow/config.yaml` and `~/.engineering-workflow/overrides/<skill>.md` are user-owned: the installer seeds them once if absent and never writes over them again. An override is appended to its skill as a `## Local overrides` section - additive layering, since prose cannot be merged semantically.

- An install reports rather than guesses. An override is refused, and the base skill installed unchanged, when it names a skill that no longer ships, carries a frontmatter fence, sets a model or invocation key, or reads as waiving a stop point or a class floor. `.reconciled.json` records the base each override was reconciled against, so an upgrade that changes that skill warns instead of relayering silently. The refusal checks are literal patterns and are documented as such - they catch obvious contradictions, not prose disagreement, which is why every applied override is named in the install output.
- Fixed: `models.yaml` under the workflow home was overwritten on every install and never read - the mapping always came from the package - so the README's instruction to edit it and reinstall did nothing. It is now seeded once as a reference copy, and `config.yaml` carries the actual precedence via `model_strategic` / `model_implementation`.
- Fixed: `config.yaml` was documented in `STATE_LAYOUT.md` but nothing created or read it.


**Orchestrator becomes the control plane.** `engineering-orchestrator` is now the only skill the human invokes and the only one the model may reach for on its own; it dispatches every other skill from a fixed routing table. Invocation mode is declared per skill as `metadata.workflow_invocation` and emitted by the adapter, replacing the blanket `disable-model-invocation: true`. Skills other than the entry point stay explicit on purpose: a gate that fires on description matching cannot be told apart from a gate that was skipped.

- Added a closed stop table, S1-S12. A stop not on the table is not a stop; a stop on it that applies is mandatory and recorded with the human's verbatim response. S2 (requirements), S8 (pre-write GO), S10 (reasoning defense) and S12 (final approval) are never waived above T0.
- Added S4, a human design statement, before `system-design-challenger`. The skill has always reviewed "an approved human design", but no stage produced one, so it would have inferred a design from the requirements and attacked its own inference. S5 (threat model) and S6 (trace model) are now likewise stated before the skill that attacks them.
- Added dispatch isolation. `system-design-challenger`, `security-adversary`, `distributed-adversary` and `senior-code-reviewer` receive the human's stated model plus source pointers, never another skill's conclusions or the orchestrator's summary. Under human invocation that independence came free; under dispatch it needed to be a rule.
- Added three-level provenance - `human`, `ai-prompted`, `ai-proposed` - and a four-rung elicitation ladder. Business and functional requirements are limited to the rungs that carry no hypothesis. `engineering-reasoning-reviewer` now targets `ai-proposed` and `ai-prompted` elements first, since those are what the engineer is least able to defend cold.
- Private state is now per change, not per project: `CHANGES.md` indexes every open change and `changes/<change-id>/STATE.md` holds its gate matrix, provenance and append-only stage ledger. A developer keeps several changes open at once and each spans many sessions, so one current-state file could not represent the truth.
- Every session starts by listing the changes in progress and asking which one. The orchestrator never resumes the most recent change by default, never assumes a new request belongs to an in-progress change, and asks even when only one change is open.
- Added a staleness check on resume. The ledger records `base_sha` and the change surface per entry; anything that moved marks its gates `STALE - RE-VERIFY`. A ledger entry records what was observed then, not what is true now.
- Added a markdown-only rule to the orchestrator and every skill. All workflow output is markdown, in conversation or as a `.md` file - never a document connector, artifact or other host-rendered surface.
- Added `WORKFLOW_GUIDE.md`, a worked change of each class T0 through T3, linked from the README.
- Constrained `N/A WITH REASON`, the one place a gate could disappear while the matrix still looked correctly filled in. Gates now start `REQUIRED` and are downgraded by an explicit act rather than composed from scratch; class floors make security, senior review and engineering reasoning undowngradable at T3 and verification and documentation undowngradable at T2+; downgrade reasons must be falsifiable claims about the repository, checked by tripwires against the change surface; and the matrix is re-evaluated at S8 against the declared surface and again against the real diff. A fired tripwire forces the gate back to `REQUIRED` without asking the human, since prompting on each would hand the human a list of negatives to approve. Tripwires read structure, not meaning - the residue is documented in the README rather than papered over.
- Contract: rule 2 now governs authorship as well as acceptance, via the three provenance levels - as written it covered only acceptance, so a requirement originating in a directed AI question read as human-accepted while being AI-originated. New rule 32 makes markdown-only binding on every skill. Former rules 32-35 renumbered to 33-36.
- Private state layout changed: `WORKFLOW_STATE.md` is replaced by `CHANGES.md` and per-change `STATE.md`, and `initProject` no longer creates project-level `requirements/`, `decisions/`, `architecture/`, `security/`, `tracing/` or `performance/`. Existing state is not migrated.

## 1.4.0

- `implementation-agent` now declares its change plan by structural impact before the first write - new files, new modules, additive edits, and modifying edits with known callers listed - instead of a flat list of affected files.
- Added a shared-surface stop: changes to a signature, contract, invariant, failure behavior or data shape consumed outside the approved scope are reported with their callers and compatibility options and await human instruction rather than being implemented. Adding a new symbol to a shared module is unaffected.
- Added an interface and module-depth section. Concrete implementation is the baseline; a single-implementation interface protecting no seam is treated as unrequested scope. The abstraction decision is surfaced - including a decision *not* to abstract - only where a plurality signal exists, so the human can correct an assumption about implementations not visible in the repository.
- Both ride on the existing pre-implementation `GO`; no new approval round and no new orchestrator gate.

## 1.3.0

- Skills are now namespaced under `aether-wfl`. Claude Code installs as a generated plugin (`/aether-wfl:engineering-guide`); hosts with a flat skill namespace get the prefix baked into the skill name (`aether-wfl-engineering-guide`).
- Host adapters are declarative. `hosts/<name>/host.yaml` describes a host's namespace mechanism, target directory and frontmatter allowlist; adding an agent needs no code change.
- Added `claude-plugin` (default), `claude-flat`, `codex` and `generic` adapters, and `aether hosts` to list them.
- `install` takes `--host`, `--target` and `--no-register`. The default host registers its generated marketplace through the `claude` CLI and falls back with a reported reason if the CLI is absent.
- Frontmatter is rebuilt per host from an allowlist, so Claude's `model` and `disable-model-invocation` no longer reach hosts that do not understand them.
- Cross-references between skills are rewritten on name-prefix hosts so a prefixed install does not point at names that do not exist there.
- Upgrading removes the pre-namespacing unprefixed skills; unrelated skills sharing the directory are left untouched. `verify` fails if both layouts are present.
- `install.json` records the host that ran, so `verify` and `uninstall` act on it rather than the default.

## 1.2.1 - Release Pipeline Validation
- No functional change. First release published through GitHub Actions Trusted Publishing (OIDC), validating the pipeline end to end.
- `npm version` now keeps `VERSION` in sync with `package.json` automatically.

## 1.2.0 - One-Command Install
- Published as the `aether-workflow` npm package: `npx aether-workflow@latest install`. Cloning the repository is no longer required.
- Ported the installer from Bash + inline Python to dependency-free Node (18+), removing the undeclared `python3` requirement and the macOS/Linux/WSL-only constraint.
- Added `verify`, `uninstall`, `init-project` and `project-id` as CLI subcommands, plus `install --dry-run` to preview every target before writing.
- Skill list is now discovered from the package payload instead of hardcoded in three shell scripts, so adding a skill no longer needs matching edits in the installer, uninstaller and verifier.
- Added a test suite covering install, idempotent reinstall, dry run, uninstall, state purge, verification failure and frontmatter rewriting.
- `install.sh`, `scripts/uninstall.sh` and `scripts/verify-install.sh` are deprecated shims that forward to the Node CLI.

## 1.1.0 - Global Personal Workflow
- Moved private workflow state outside target repositories.
- Made the system explicitly personal/global rather than a team repository convention.
- Added Claude host adapter with centralized model profiles.
- Added install/update/uninstall/verification scripts.
- Added model metadata to every skill.
- Strengthened explicit `GO` write authorization.
- Made documentation guardian aware of branch-sync drift and shared-vs-private documentation.
- Kept risk-based routing with security always-on.
