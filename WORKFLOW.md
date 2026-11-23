# The workflow

This is the day-to-day flow the `aether-wfl` plugin supports. Every command below is a plugin skill, written as `/aether-wfl:<name>`. Install first: see [README.md](README.md).

## Once per repo

1. `/aether-wfl:codemap` (Sonnet) builds `.plans/CODEMAP.md`.
2. Optional: `/understand`, an interactive tour of the code for you. **It is not part of aether and is not installed by it**: it comes from the separate understand-anything plugin. aether does not depend on it. If its knowledge graph exists (`.ua/knowledge-graph.json` or `.understand-anything/knowledge-graph.json`), `/aether-wfl:codemap` uses it as a starting inventory and checks it against the tree; without it, codemap maps the repo itself. If you use it, run it in the main checkout and leave its auto-update off.

## Every session (automatic)

- A one-line notice appears if the codemap is behind recent commits. Run `/aether-wfl:codemap` when you're about to work in the areas that changed.
- Subagents can't run on Haiku or Fable; the hook blocks them. Your default model is Sonnet.

## A. Feature

1. `/aether-wfl:plan-change <task or ticket>`, in normal mode (runs on Opus).
2. Answer all decisions in one reply, then approve.
3. Work on a feature branch, or in a git worktree if you use them (`git worktree add ../<repo>-<feature> -b <feature>`). Implementation stops if you are on the repo's default branch or the plan's base branch.
   After approval, `/aether-wfl:plan-change` asks once: "Implement now?"
4. On yes, it runs the plan in waves with Sonnet workers. Each wave is one commit on the branch.
5. After the waves it runs the Definition of done checks, then an Opus preflight, with at most 3 fix rounds. It fixes only the must-fixes that are auto-fixable. It stops and asks you on security findings, drift from the plan, test-expectation changes, manual DoD items and anything outside the plan.
6. It writes `.plans/<slug>-report.md` and records the decisions plus a plan summary in `.decisions/`.
   On no, resume later with `/aether-wfl:plan-change <plan>` and say "implement". Or revise the plan first: write `change:` in the Review cells and approve again. You can also implement slice by slice yourself: "implement slice N of `.plans/<slug>.md`".
7. A separate `/aether-wfl:preflight` is then only needed if you implemented by hand. Fix the security section and must-fix items; decide on any drift.
8. If the branch has to be merged into another one, preview it first with `/aether-wfl:pull <source> into <target>`. It tests the merge without touching the target and reports conflicts and clean merges that change behaviour. It merges locally only if you say yes, and never pushes. To open a PR or MR, use `/aether-wfl:pr <feature> -> <target>`. It runs the same preview, merges the target into your feature branch and pushes that branch only on your yes, then creates the PR (`gh`) or MR (`glab`) and returns the link. Neither pushes the target or merges the PR.
9. Merge.

## B. Small task

It counts as small only if it's one file, under ~30 lines, adds no new function and doesn't touch auth or input handling.

1. Ask on Sonnet.
2. Run the tests.
3. Skip `/aether-wfl:preflight` unless it touches shared code.

## C. Bug

1. `/aether-wfl:diagnosing-bugs <symptom, error, steps to reproduce>` on Sonnet.
2. Get one command that reproduces the bug before any theorising.
3. Switch to Opus if it can't reproduce, or if its first hypothesis turns out wrong.
4. Fix once the cause is confirmed:
   - Small and local: fix it directly.
   - Shared code, a larger fix, or anything touching security: run `/aether-wfl:plan-change`, then the feature flow from step 2.
5. Commit the reproduction as a regression test.
6. Run `/aether-wfl:preflight`, unless the fix was trivial.

## D. Recurring maintenance: alternate weeks to spread usage

- Week 1: full security audit. Ask `/aether-wfl:security-audit` for a full codebase audit, on Opus, in a fresh session at the start of a 5-hour window, since it's the most expensive run.
  - Results go to `~/security-audit-skill/<repo>/run-N/`. This matches the skill: the default output directory is `~/security-audit-skill/<repo-name>/run-<N>`, with N the next unused number, outside the repo.
  - Fix findings through `/aether-wfl:plan-change`.
  - Also run it out of cycle after auth, payment or input-handling changes, and before a major release.
- Week 2: `/aether-wfl:dead-code` on Sonnet.
  - Review `.plans/dead-code-<date>.md`.
  - Remove the safe items with `/aether-wfl:plan-change remove the Safe items in <report>`.
  - Pass any reachable-but-unused routes it lists to the next security audit.
- Every 2 weeks, or before working in an area that changed a lot: `/aether-wfl:codemap`, plus `/understand` if you have it installed and use the tour.

## Models

| Model | Use it for |
|---|---|
| Sonnet | Default. Small tasks, implementation, `/aether-wfl:codemap`, `/aether-wfl:dead-code`, running `/aether-wfl:preflight`, first-pass debugging |
| Opus | `/aether-wfl:plan-change` and the `/aether-wfl:preflight` reviewer (both switch automatically). The security audit and stalled debugging (you switch with `/model opus`) |
| Never | Haiku and Fable. Subagents are blocked by the hook; agents started outside Claude Code's subagents only by the rule in `rules/AETHER.md` (imported into your CLAUDE.md) |
