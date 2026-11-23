---
name: preflight
description: Pre-merge review of a change for what breaks, what drifts from the agreed spec, and what fits poorly, reported as one ranked list. Reports only; changes nothing.
disable-model-invocation: true
model: sonnet
argument-hint: "[base branch, e.g. s2; detected when omitted] [spec or ticket path]"
---

# Preflight

One reviewer, running in a fresh subagent so it carries none of the author's reasoning, checks a change through three lenses in priority order: **Breaks**, **Spec**, **Fit**. This session pins the change, gathers sources, dispatches the reviewer, and relays its report.

This is a report. It changes no code and writes no files, including `.vibe-wise/` notes. The user owns every decision about what to fix.

## 1. Pin the change

- **Base**: the user's argument (branch, commit, tag) when given. Otherwise run `bash ${CLAUDE_SKILL_DIR}/find-base.sh`, inside the repo. It prints `<base> <how>`, where how is `reflog` (the branch's recorded parent) or `nearest` (the branch this one forked from most recently). Exit 2 means two branches tie: show the candidates and ask the user which one. Exit 1: ask the user for the base.
- If the branch has no commits beyond the base, review uncommitted changes instead.
- If it has commits beyond the base **and** `git status --porcelain` is non-empty (modified, staged or untracked files; git-ignored ones like `.plans/` don't show), stop and ask the user to commit or stash first. Otherwise the review covers only the committed part, and the Done report check re-runs evidence in a worktree built from HEAD, without those changes.
- Capture the diff command once (`git diff <base>...HEAD`, or `git diff HEAD` for uncommitted work) and the commit list.
- Done when the base resolves and the diff is non-empty. Stop here on a bad ref or an empty diff.

## 2. Gather sources

Record each source as a path, or as "absent".

- **Plan**: an approved `/aether-wfl:plan-change` plan. Look in `.plans/` of the current worktree (`git rev-parse --show-toplevel`), then of the main checkout (`dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`, where older plans live), for files whose frontmatter `status` is `approved`, `implementing` or `done` and whose `base` branch is this diff's base or the current branch, or a plan path the user passed. Several match: ask which. When a plan is found it is the primary spec, and its `Allowed files`, reuse inventory, dependencies, security decisions and slice budgets are all checked.
- **Spec**, in order: a path the user passed; issue references in commit messages; a matching file under `.scratch/`, `docs/` or `specs/`; the **confirmed** decisions in `.vibe-wise/progress.md` (confirmed or implemented only, never proposed). Several can combine. None found: ask the user once; if there is none, the Spec lens is skipped and the report says so.
- **Standards**: any repo file that documents how code is written (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`), plus lint and formatter configs. None is normal; the Fit lens then runs on its baseline.
- **Expected load**: README, deploy or infra config. Record what it says, or "unknown".

## 3. Dispatch the reviewer

Read [reviewer.md](reviewer.md) and spawn one general-purpose subagent with `model: "opus"` whose prompt carries, pasted in full (the subagent cannot read this skill's folder):

- the contents of `reviewer.md`;
- the diff command and commit list;
- the source paths and the expected load from step 2.

## 4. Relay

Open with one line naming the base and how it was found, e.g. `Base: s2 (from reflog)` or `Base: origin/staging (nearest fork point; pass a branch to override)`, so a wrong base is caught at a glance. Then present the reviewer's report as returned, lightly cleaned. If a finding cites a line that plainly does not say what the finding claims, drop it and add one to `Dropped in verification`.

End the reply after the report. Choosing which findings to act on is the user's next move.
