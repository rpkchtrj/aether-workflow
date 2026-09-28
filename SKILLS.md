# Skill Catalog

`engineering-orchestrator` is the only skill a human invokes and the only one the model may reach for on its own. Every other skill is dispatched by the orchestrator from its routing table, never by description matching — a gate that fires probabilistically cannot be told apart from a gate that was skipped.

| Skill | Model profile | Invocation | Primary role |
|---|---|---|---|
| engineering-orchestrator | strategic | auto | control plane: risk routing, gates, the only human interface |
| engineering-guide | strategic | dispatched | change index, per-change ledger, resume and staleness |
| requirements-architect | strategic | dispatched | human-owned requirements with provenance |
| system-design-challenger | strategic | dispatched | adversarial review of the human's design |
| security-adversary | strategic | dispatched | attacks the human's threat model, design and implementation passes |
| distributed-tracing-engineer | strategic | dispatched | causal telemetry design, review, and validation |
| implementation-agent | implementation | dispatched | approved coding, declared change surface |
| runtime-engineer | implementation | dispatched | runtime/language reasoning |
| verification-engineer | implementation | dispatched | evidence and tests |
| distributed-adversary | strategic | dispatched | distributed failure attack |
| chaos-engineer | implementation | dispatched | controlled fault injection |
| performance-engineer | strategic | dispatched | measured performance engineering |
| senior-code-reviewer | strategic | dispatched | independent final review |
| engineering-reasoning-reviewer | strategic | dispatched | provenance-targeted defense of the change |
| documentation-guardian | strategic | dispatched | detect and reconcile material documentation drift |
| ai-incident-commander | strategic | dispatched | incident diagnosis |

**Isolated on dispatch** — `system-design-challenger`, `security-adversary`, `distributed-adversary`, `senior-code-reviewer`. They receive the human's stated model and pointers to source, never another skill's conclusions.

Invocation mode is declared per skill as `metadata.workflow_invocation` and mapped to the host's own mechanism by the adapter, so the declaration stays portable.
