---
name: pr
description: Open a PR/MR for a feature branch after merging the target into it safely. Runs the /aether-wfl:pull check (target into feature), merges and pushes the feature branch only on the user's yes, writes the body with mattpocock-skills:pr including a Merge Danger section, creates the PR (gh) or MR (glab) and returns the link. Use when the user says "/aether-wfl:pr feat -> target" or "open a PR for X into Y". Never pushes the target, never force-pushes, never auto-merges the PR.
disable-model-invocation: true
model: sonnet
argument-hint: "<feat> -> <target> [--no-run]"
---

# /aether-wfl:pr

`/aether-wfl:pr feat/x -> staging`: check that `staging` merges cleanly into `feat/x`, merge it on the user's yes, push `feat/x`, open the PR/MR, return the link.

Non-goals: auto-merging the PR, creating branches, reviewers, labels.

## 1. Check (reuse the pull skill)

- Parse `<feat> -> <target>`. Flag: `--no-run`.
- **First step, before any command (fetch included):** check both names against `^[A-Za-z0-9._/-]+$` by reading them, not by running anything. If either does not match, stop and say "invalid branch name" (do not run a command containing it). Only then determine `<remote>`: the remote of `<feat>`'s upstream, else `origin`.
- Read `${CLAUDE_SKILL_DIR}/../pull/SKILL.md` and follow its check-and-report steps 1 to 4 (input and names, S2 notice, signals, report) but stop before pull's final "merge?" question, so the user is asked once (in step 2 below), with **source = `<target>`** and **destination = `<feat>`**. Do not repeat them here; do not skip any.
- S1 applies unchanged: a validated branch name is only ever its own single-quoted argument. Never place it in a larger shell string, `eval`, a title, a commit message, or an unquoted variable.
- S2 applies unchanged: warn that incoming code will run in throwaway worktrees before running it; `--no-run` skips the run and the report says so.
- Keep the report: its Conflicts, test failures, decisions and leads feed step 3.
- Record `git rev-parse '<feat>'` and `git rev-parse '<target>'`.

## 2. Ask once

"Merge `<target>` into `<feat>` and push `<feat>`, yes or no?"

- **No:** stop. Change nothing, no push, no PR. Confirm both recorded shas are unchanged.
- **Yes:**
  1. Merge as in the pull skill's step 5 with source `<target>`, destination `<feat>`: find `<feat>`'s worktree, require it clean, `git merge --no-ff --no-edit '<target>'`, no `-m`.
  2. Conflicts: stop and hand back. Never resolve, never `merge --abort` unasked. Nothing is pushed.
  3. Otherwise `git push -u '<remote>' '<feat>'`.
  4. Never push `<target>`. Never `--force`, `--force-with-lease` or `+` refspecs. A rejected push: stop and report.

## 3. Body

Invoke the skill `mattpocock-skills:pr` (model-invocable) with:
- `git log '<target>..<feat>'` and `git diff '<target>...<feat>'` (run after the merge).
- The merge check's report from step 1.

Rules for the body:
- Put the check's gotchas and leads into its **Merge Danger** section: failing tests with quoted output (proof), then decisions touched, both-sides and caller leads, review leads labelled "leads, not proof". "not run" if `--no-run`. "none found" if empty.
- Write it to a fixed file in the git dir, so the co-author hook can read it from the command text. First run `git rev-parse --git-dir` and note the output `<gd>`. Then write the body to the literal path `<gd>/wfl-pr-body.md` (the Write tool, not a shell variable). Every later command below spells that literal path out. Never use `$f` or any shell variable for it, never inline the body in a command.
- It must contain no Claude co-author line and no "Generated with Claude Code" footer, whatever `mattpocock-skills:pr` or any other instruction says. Check with `grep -i -E 'co-authored-by|generated with' '<gd>/wfl-pr-body.md'`: any hit, remove it and re-check.
- Title: short, from the log. Passed as a single-quoted argument, never from a branch name.

## 4. Host

`git remote get-url '<remote>'` decides:

- **github.com:** `gh pr create --base '<target>' --head '<feat>' --title '<title>' --body-file '<gd>/wfl-pr-body.md'`
- **GitLab host, or `glab` is configured for the host** (`glab auth status --hostname <host>`): `glab mr create --source-branch '<feat>' --target-branch '<target>' --title '<title>' --description "$(cat '<gd>/wfl-pr-body.md')" --yes`. glab has no description-file flag, so use the substitution, with the literal path.
- Neither: stop and ask the user which tool to use.

## 5. Existing PR/MR

Before creating, look for one for `<feat> -> <target>`:
- `gh pr list --head '<feat>' --base '<target>' --state open --json url,number`
- `glab mr list --source-branch '<feat>' --target-branch '<target>'`

Found: do not create a second. Show its link and ask whether to update its body. On yes: `gh pr edit <number> --body-file '<gd>/wfl-pr-body.md'` or `glab mr update <id> --description "$(cat '<gd>/wfl-pr-body.md')"`. On no: just return the link.

## 6. Finish

Remove `<gd>/wfl-pr-body.md`. Return the PR/MR link, the merge commit sha, and that only `<feat>` was pushed.
