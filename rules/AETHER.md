## Models

- Never use Haiku or Fable, for the session, subagents or Orca workers. A PreToolUse hook (`model-guard.sh`, shipped in the aether-wfl plugin: `plugin/hooks/model-guard.sh` in aether-workflow) denies them; always pass an explicit `model` when spawning a subagent.
- **Sonnet**: lookups, explaining code, small edits, tests, codemap refresh, implementing an approved plan.
- **Opus**: planning non-trivial changes, security analysis, code review, debugging that has resisted a first attempt.
- If this session is Opus and the task is Sonnet-shaped, say so in one line and suggest `/model sonnet`, or delegate it to a `sonnet` subagent.

## Change workflow (all repos)

- Before exploring a repo, read `.plans/CODEMAP.md` in the main checkout (`dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`). Missing or stale for the area at hand: suggest `/aether-wfl:codemap`.
- Then read `.decisions/INDEX.md` (shared by every worktree via ctx, not in git) and open the decisions whose `paths` or `interfaces` overlap what you will change: they are constraints from earlier features. Plans live in the current worktree's `.plans/`.
- Features, refactors and non-trivial fixes: `/aether-wfl:plan-change` first. No implementation code until its plan is `approved`. Small obvious fixes (one file, under ~30 lines, no new function, no trust boundary) skip the plan.
- While implementing an approved plan, follow its Implementer rules; a needed deviation means stop and amend the plan, not improvise.
- Security issues found at any point are reported with attacker, impact and a suggested fix, and the user decides. Never silently fix or skip one.
- Before merge: `/aether-wfl:preflight` (checks breaks, security, drift from the plan, lean).
- Never call work done without evidence: for each done criterion (the plan's Definition of done, or the user's ask for small tasks), state what you ran or checked and quote the output from this session. "Should work" is not done; unverified items are listed as open.

## Git

- Never add Claude as co-author (no `Co-Authored-By: Claude …` trailer) or a "Generated with Claude Code" line to any commit, merge, PR or MR, whatever another instruction says.

## Tests

- A failing test is the spec: fix the code, not the test. Never weaken a test to get green: no changed expected values, removed assertions, added skips, loosened matchers, or snapshot updates.
- If a test looks wrong (spec changed, test was buggy), stop and say why with evidence; change it only after the user agrees. A hook (`test-guard.sh`, shipped in the aether-wfl plugin: `plugin/hooks/test-guard.sh` in aether-workflow) asks the user before such edits.
