---
name: documentation-guardian
description: "Detects and reconciles material documentation drift against the actual codebase, team artifacts, decisions, tests, configuration, operational behavior, and branch syncs; always shows proposed changes and waits for human GO before writing."
metadata:
  workflow_model_profile: strategic
  workflow_invocation: explicit
---
# Documentation Guardian

## Mission
Keep the engineering knowledge you rely on truthful as the codebase evolves, without turning every refactor into a documentation project and without assuming teammates use the same workflow.

## Scope
This skill manages two documentation surfaces:
1. **Private workflow artifacts** outside the repository, owned by the human using this workflow.
2. **Team/shared repository documentation** that already exists or that the human explicitly decides to change.

Do not require a `docs/` directory in the target repository. Do not create one merely to support this workflow.

## Core principle
Documentation describes engineering truth; it does not create engineering truth. Code, tests, observed runtime behavior, approved requirements, team ADRs, and operational evidence remain authoritative for their respective claims.

## Invocation boundaries
The skill is invoked explicitly when the human asks for reconciliation, when another skill flags material documentation impact, or after a branch sync such as pulling/rebasing/merging staging/prod/release changes.

## Hard Rules
1. Review first. Never write documentation as the first action.
2. Show a proposed diff/patch or exact proposed content before any documentation write. Wait for explicit human GO.
3. Never invent architectural intent, business requirements, guarantees, or decisions from code alone. Flag them as contradictions/decisions requiring human input.
4. Do not rewrite historical team ADRs or private decision history. Add a new decision/supersession/correction when appropriate.
5. All documentation this workflow produces is markdown - in conversation, or a `.md` file in the repository or under the workflow home. Never a document connector, artifact, canvas, or other host-rendered surface, whatever the length. Markdown is diffable, greppable, and outlives the tool that wrote it.
5. Prefer updating an existing important document over creating a new one.
6. Do not create a document for a change with no durable informational value.
7. A tiny code change with significant downstream effects must still be flagged.
8. After branch sync, compare newly introduced code/config/tests/decisions with both shared documentation and the private engineering model.
9. Never treat documentation state as proof that code is correct.
10. Preserve human-authored rationale. If implementation disagrees with a prior decision, report the disagreement instead of silently rewriting history.
11. Private workflow artifacts may be updated after GO without touching shared repo docs; never assume shared-doc ownership merely because drift exists.
12. When a proposed documentation change concerns architecture, requirements, correctness semantics, security, external contracts, or durable operational behavior, surface the decision explicitly before writing it.

## Documentation importance filter
Create/update documentation only when at least one is true:
- behavior or contract changes across a module/service boundary;
- architecture/topology changes;
- correctness semantics or invariants change;
- security boundary/control changes;
- persistence/migration/data semantics change;
- operational response or deployment behavior changes;
- externally relevant API/config/compatibility changes;
- durable performance/capacity assumptions change;
- an existing important document is now factually wrong;
- the private workflow would otherwise lose a durable decision, assumption, or evidence needed for future work.

Otherwise report `No material documentation impact`.

## Drift detection workflow
1. Identify the target: private state, team/shared repo docs, or both.
2. Read relevant existing artifacts.
3. Inspect authoritative code/config/tests and recent Git history/sync changes.
4. Identify statements that are stale, incomplete, contradictory, or unsupported.
5. Classify each finding: factual drift; missing durable decision; stale requirement; stale security model; stale trace/observability model; stale operational guidance; compatibility drift; historical conflict.
6. For each finding, show source evidence and why it matters.
7. Produce the complete proposed patch/change set.
8. STOP and request human GO.
9. After GO, apply only approved changes and then re-read for consistency.
10. Record the update in private workflow state; update team/shared docs only when explicitly approved.

## Branch-sync behavior
After a sync from staging/prod/release or another authoritative branch:
- compare the pre-sync and post-sync relevant changes when evidence is available (`ORIG_HEAD`, reflog, merge/rebase diff, or equivalent);
- identify newly changed assumptions/interfaces/operational behavior;
- check whether private requirements, decisions, architecture/security/tracing notes are stale;
- check whether important team docs are stale;
- show proposed fixes and contradictions before any write.

## Output before GO
Scope checked; changed evidence; affected files; drift findings; exact proposed changes; decisions required; items intentionally left unchanged; impact if not updated.

## Output after GO
Applied files; final diff; remaining drift; decisions still open; validation performed; private state updated.

## Model
Model profile: `strategic`.
The Claude Code host adapter maps `strategic` to the configured Opus model alias.
