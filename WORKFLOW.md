# Workplace Workflow

This workflow is a **personal global process**. It does not assume teammates follow it. Target repositories can remain exactly as the team maintains them.

## Control plane

`engineering-orchestrator` is the workflow's single entry point and the only skill the human talks to. It classifies the change, dispatches every other skill from a fixed routing table, streams their output, and stops only at enumerated stop points. The human never invokes another workflow skill directly.

Dispatch is not autonomy. Choosing the next skill is mechanical; deciding what the change should be, whether it is correct, and whether it ships stays human. Accordingly the orchestrator is the only skill that is model-invocable — a gate that fired on description matching could not be told apart from a gate that was skipped, which would defeat the gate matrix.

## Session start

A developer has several changes open at once and one change spans many sessions. Every session begins the same way: the orchestrator reads private state and lists the changes in progress, then asks which one this session is about, or whether to start a new one. It never resumes the most recent change by default, and never assumes a new request belongs to an in-progress change — even when only one change is open.

On resume it compares the recorded `base_sha` and change surface against the current tree and base branch. Anything that moved marks its dependent gates `STALE — RE-VERIFY`. A ledger entry records what was observed then, not what is true now.

## Operating sequence

```text
Human intent
  -> select or start a change
  -> classify risk
  -> security impact check
  -> documentation impact check
  -> human-owned requirements
  -> human-stated design, threat model, trace model
  -> AI challenge of each
  -> human decision
  -> explicit GO
  -> implementation
  -> verification
  -> adversarial tracks as applicable
  -> independent review
  -> reasoning defense
  -> proposed documentation reconciliation
  -> human final approval
  -> private state update
```

## Stop points

The set is closed. A stop that is not on this table is not a stop; a stop that is on it and applies is mandatory and recorded with the human's verbatim response.

| ID | Stop | Human supplies |
|---|---|---|
| S1 | Intent and scope | what is being built and why |
| S2 | Requirements | business/functional requirements, human-authored |
| S3 | NFR disposition | accept / reject / defer each proposed non-functional requirement |
| S4 | Design statement | components, ownership, contracts, state, failure behavior |
| S5 | Threat model | assets, actors, trust boundaries, abuse cases |
| S6 | Trace model | logical operations, causal boundaries |
| S7 | Design decision / ADR | resolve challenges; dispose of proposed alternatives |
| S8 | Pre-write GO | approve the declared change surface |
| S9 | Stop-ship finding | fix / accept risk / abandon |
| S10 | Reasoning defense | answers from the engineer's own understanding |
| S11 | Documentation write GO | approve the proposed diff |
| S12 | Final approval | ship / do not ship |

S2, S8, S10, and S12 are never waived above T0. The human states the requirements, authorizes the write, defends the change, and approves the ship.

## Human authorship

The adversarial skills are built on *human states the model, AI attacks it*: `system-design-challenger` reviews an approved human design, `security-adversary` begins from the human threat model, `distributed-tracing-engineer` draws the human's trace model before critique. None of them authors the thing it reviews. A skill that has no human artifact to attack stops and asks rather than inferring one and attacking its own inference.

When the human does not have a model ready — an unfamiliar subsystem is the normal case — the orchestrator escalates along a fixed ladder, and every rung is recorded:

| Rung | Form | Result is |
|---|---|---|
| 1 | Open question, no hypothesis | `human` |
| 2 | Directed probe containing a hypothesis | `ai-prompted` |
| 3 | Named gaps, no content | `ai-prompted` |
| 4 | Explicit candidate with trade-offs | `ai-proposed`, needs disposition |

Business and functional requirements are limited to rungs 1 and 3 — never a proposed candidate. Everything else may use all four. At S10 the reasoning reviewer targets `ai-proposed` and `ai-prompted` elements hardest, because those are what the engineer is least able to defend cold. That is what makes leaning on rung 4 safe rather than merely fast.

## Gate matrix

Every meaningful change gets an explicit matrix. Each concern is one of:

- `REQUIRED`
- `N/A WITH REASON`
- `OPTIONAL WITH REASON`

The workflow is risk-based, but never silently incomplete.

## Gate downgrades

`N/A WITH REASON` is the one place a gate can disappear while the matrix still looks correctly filled in: the judgment is model-side, and prose like "no security boundary" cannot be contradicted by anything.

Under dispatch the economics have changed. A gate that runs unnecessarily now costs a dispatch, not a human turn — so the bar is no longer "prove this gate is necessary" but "prove it is safe to drop." Four constraints:

**1. Start REQUIRED.** The matrix is built from a fixed gate list with every row `REQUIRED`, then downgraded by an explicit act. It is never composed from scratch, because a gate nobody considered and a gate deliberately dropped look identical once the row is missing.

**2. Class floors.** At T3, security, senior review, and engineering reasoning cannot be downgraded. At T2 and above, neither can verification or documentation impact. If a floored gate looks inapplicable, the classification is wrong, not the gate — a T3 whose security gate does not apply was not a T3. Distributed and tracing stay downgradable at every class; they genuinely do not apply to in-process work.

**3. Tripwires.** A downgrade reason must be falsifiable — a claim about the repository that could turn out to be false — and is checked mechanically against the change surface.

| Gate | Downgrade is contradicted if the surface touches |
|---|---|
| Security | auth/authz paths, crypto, secret handling, input parsing or deserialization, external I/O, path construction, resource limits |
| Distributed correctness | queue or broker clients, HTTP/gRPC clients, background jobs, schedulers, retry logic, any process boundary |
| Tracing | existing instrumentation, context propagation, or a new asynchronous boundary |
| Documentation | any file referenced by a `.md` in the repository or in private state |
| Performance | a hot path carrying a benchmark or recorded baseline |

A fired tripwire forces the gate back to `REQUIRED` and does not ask the human. Prompting on each one would produce a stream of negatives to approve, which is alarm fatigue and gets rubber-stamped; forcing costs a dispatch, not attention. The asymmetry: **model judgment may add a gate, never remove one against evidence.**

**4. Re-evaluation.** The matrix is first decided at classification, off a sentence of description, when the least is known. Tripwires are re-run at S8 against the declared change surface — the first moment the surface is fact — and again against the real diff after implementation. Any downgrade the evidence contradicts reopens. A gate reopened at S8 costs one dispatch; a gate wrongly closed at classification costs an incident.

These shrink silent skips to the cases that need semantic understanding to spot, and floor the ones where being wrong is worst. They do not eliminate the class — see the limitation noted in the README.

## Dispatch isolation

`system-design-challenger`, `security-adversary`, `distributed-adversary`, and `senior-code-reviewer` receive the human's stated model plus pointers to the source, and nothing else — not the implementation agent's rationale, not earlier skills' conclusions, not the orchestrator's summary. Under human invocation that independence came free; under dispatch it is an explicit rule, because a reviewer handed a digest reviews the digest.

Output streams one skill at a time, in full, as each completes. It is never bundled into a single digest — a wall of text gets approved rather than read.

## Markdown only

Every artifact this workflow produces is markdown: in conversation, or a `.md` file in the repository or under the workflow home. Never a document connector, artifact, canvas, or other host-rendered document surface, whatever the length or formatting benefit. Markdown is diffable, greppable, reviewable a year later, and outlives the tool that wrote it.

## Human authority

AI does not own requirements, invariants, correctness semantics, architecture, security acceptance, trade-offs, or final approval. Skill invocation is not write authorization. Before the first material write, the agent shows the intended change, affected files, risks, and verification plan, then waits for `GO`.

## Security

Security is considered on every meaningful change. If a seemingly tiny change can affect an authorization boundary, sensitive data, external side effect, resource limit, input validation, secret handling, or trust assumption elsewhere, the change escalates.

## Distributed behavior

Distributed/adversarial checks are required when the system actually crosses process, network, asynchronous, or durable coordination boundaries. They are not forced into a purely local change.

## Documentation

The workflow never requires a `docs/` directory in the target repository. Private workflow state lives outside Git. Existing team docs are read as team/shared artifacts. `documentation-guardian` identifies drift in both private notes and shared docs, but writes only after explicit human GO.

## Branch sync

A pull/rebase/merge from staging/prod/release is treated as new change input. Re-check assumptions and documentation before resuming work, and re-verify the gates that were observed against the old code.

## Worked examples

`WORKFLOW_GUIDE.md` walks one change of each class, T0 through T3, end to end.
