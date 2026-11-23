# /aether-wfl:preflight

A pre-merge code review skill for Claude Code. One reviewer, in a fresh context, checks your branch for:

- **Breaks**: bugs, security holes, data loss, behaviour under load, risky code without tests.
- **Spec**: whether the change does what the ticket asked. It reports what's missing, what's wrong, and anything added that nobody asked for.
- **Fit**: your repo's coding standards, reuse of code that already exists, and sound design without over-engineering.

It reports only. It never changes your code.

## Install

This skill ships in the `aether-wfl` plugin (marketplace `aether`, this repo's `.claude-plugin/marketplace.json`); `./install.sh` registers and installs it. Run `/reload-plugins` or start a new session, then type `/aether-wfl:preflight` to check it's picked up. The folder must contain `SKILL.md`, `reviewer.md` and `find-base.sh`.

**Requirements:** Claude Code, git, bash (macOS and Linux have it; on Windows use WSL or Git Bash). To reproduce bugs it also needs your project's own toolchain, such as `node`, `go` or `python3`.

## Use

On your feature branch, after committing:

```
/aether-wfl:preflight                          # base branch is detected automatically
/aether-wfl:preflight staging                  # or name the base yourself
/aether-wfl:preflight s2 docs/tickets/PAY-12.md  # base plus the spec to check against
```

### Base branch

It compares your branch against the branch you created it from, not always `main`:

1. **Git's local record of branch switches** (the reflog). If you ran `git checkout -b feat/x` while on `s2`, the base is `s2`. This is exact.
2. **Nearest fork point.** On a fresh clone, or when that record has expired, it picks the branch your work forked from most recently.
3. **A tie.** If two branches are equally likely, it asks you.

The report opens with `Base: <branch> (<how it was found>)`. Check this line: a wrong base means it reviewed the wrong diff.

### Spec

The Spec check needs something to compare against. `/aether-wfl:preflight` looks in this order:

1. A path you pass.
2. Issue references in your commit messages.
3. A matching file under `.scratch/`, `docs/` or `specs/`.
4. Confirmed decisions in `.vibe-wise/progress.md`, if you use the VibeWise plugin.

Easiest habit: paste the ticket into `.scratch/<feature>/issue.md`. To keep it out of commits, add `.scratch/` to `.git/info/exclude`. If no spec is found, it asks once; with no spec it skips the Spec check and says so in the report.

### Standards

If the repo documents how code should be written, `/aether-wfl:preflight` applies those rules first. It looks for `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `AGENTS.md` or `CLAUDE.md`, plus lint configs. Without them it uses its own rules, in this order:

1. No over-engineering.
2. Deep modules.
3. Separation of concerns.
4. SOLID.
5. Coupling.
6. Design patterns, only where the code already has the problem they solve.
7. Readability.

## Reading the report

- **Must fix / Should fix / Nice to have.** Findings are numbered, so you can say "fix 1, 3 and 4".
- **Each finding** has a concrete problem, the smallest fix, and what happens if you skip it.
- **"Checked:"** says `reproduced` (it ran code and saw the bug) or `from reading`. Weigh "from reading" findings a little more critically.
- **"possible …"** marks a design finding that's a judgement call. Discuss it rather than treating it as a ruling.
- **The closing lines:**
  - **Verdict:** `Ship.` or `fix 1 and 3 first`.
  - **Lean:** how many lines could be deleted.
  - **Not checked:** what it couldn't verify. Read this line; it's where gaps show up.

## Permissions

On first use, Claude Code asks permission to:

- read the skill's own files;
- run `find-base.sh`;
- create a temporary git worktree and run code inside it (`git`, plus your toolchain).

Reproductions run only in that temporary checkout, which is deleted afterwards. Your working tree and data files are never touched.

## Cost and limits

- About $0.60–0.85 and a few minutes per review. Running code to confirm bugs is what makes it more expensive than a read-only review, and also what keeps false claims down.
- Tested on small Python, TypeScript and Go repos with planted problems: it caught nearly all of them and left the deliberately correct decoy code alone. Real codebases are harder; treat early runs as a calibration period.
- The temporary checkout has no installed dependencies (`node_modules`, build output), so in heavy projects expect more "from reading" findings.
- If you're on a long-lived branch itself (e.g. `staging`), there's no real parent branch, so pass the base explicitly.

## Optional: with VibeWise

If you use the VibeWise learning plugin, `/aether-wfl:preflight` reads its confirmed design decisions as part of the spec. It ignores decisions that were only proposed. It also never writes to the `.vibe-wise/` notes. After a review, tell VibeWise which findings to fix, then rerun `/aether-wfl:preflight`.

## With /aether-wfl:plan-change

If an approved plan exists in `.plans/` (the current worktree, or the main checkout for older plans), `/aether-wfl:preflight` uses it as the primary spec and adds a **Drift** check: files outside the plan's allowed list, functions or dependencies the plan didn't approve, security decisions not implemented as agreed, and slices over budget. Security findings get their own group at the top of the report. The orchestration runs on Sonnet; the reviewer subagent runs on Opus.
