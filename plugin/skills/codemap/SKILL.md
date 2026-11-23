---
name: codemap
description: Build or refresh a compact, agent-facing map of a codebase (modules, entry points, shared helpers with signatures, installed libraries, conventions) at .plans/CODEMAP.md, so agents find where things are and what to reuse without exploring the whole repo. Use when CODEMAP.md is missing or stale, or when the user asks to map the codebase for agents.
model: sonnet
argument-hint: "[refresh]"
---

# /aether-wfl:codemap

Writes one file: `<main-root>/.plans/CODEMAP.md`. Read-only on everything else.

It is a lookup table for agents, not a tour for humans (understand-anything does that). Every line must help an agent answer one of: *where does X live*, *what already does Y*, *which library handles Z*, *how does this repo do W*.

## 0. Resolve the location

`.plans/` lives in the **main checkout**, so every Orca or git worktree of the repo shares it (it is git-ignored, so worktrees would not get it otherwise):

```bash
common=$(git rev-parse --path-format=absolute --git-common-dir)
root=$( [ "$(basename "$common")" = ".git" ] && dirname "$common" || git rev-parse --show-toplevel )
[ "$(git rev-parse --show-toplevel)" = "$root" ] || echo "NOT MAIN CHECKOUT"
mkdir -p "$root/.plans"
```

One codemap per repo, owned by the branch checked out in the main checkout. If the check prints `NOT MAIN CHECKOUT`, stop without writing: a worktree may be on another branch (a hotfix off `main`), and mapping it would overwrite the shared map with that branch's code. Tell the user to run `/aether-wfl:codemap` from `$root`. The main checkout also refreshes it after every merge into its branch (post-merge hook, `codemap-sync`).

Map the code of the main checkout, write the file under `$root`.

## 1. Fresh, incremental or full

- No `CODEMAP.md`, or argument `refresh`: full build.
- Otherwise read its `Mapped at` commit and run `git diff --name-only <commit>..HEAD`. Nothing in source dirs changed: say it is current and stop. Otherwise rebuild only the sections for the changed modules, plus Helpers and Libraries if any changed file exports something or touches a dependency manifest.

## 2. Gather (cheaply)

- If an understand-anything graph exists (`$root/.ua/knowledge-graph.json` or `$root/.understand-anything/knowledge-graph.json`), use its file summaries and layers as the starting inventory. Verify against the tree; the graph may be stale.
- Otherwise: tree listing excluding vendored and generated dirs, dependency manifests, entry points (main files, route registration, handlers, CLI commands, workers, cron), and exported symbols via grep or LSP.
- On a large repo, split by top-level module across general-purpose subagents with `model: "sonnet"`, each returning its sections in the format below.

## 3. Write

Use this structure. Target under 400 lines; cut prose before cutting entries.

```markdown
# Codemap: <repo>
Mapped at: <short sha> on <branch>, <YYYY-MM-DD>
Stack: <languages, frameworks, runtime>
Rule: this map says where to look. Read the file before editing it.

## Modules
### <path/>: <one-line purpose>
- Entry: <path:line symbol> (route / handler / command / job)
- Owns: <data, tables, queues, external APIs it talks to>
- Depends on: <other modules>

## Shared helpers and utilities
<path:line> `name(signature) -> return`: what it does, in one line.
(Group by concern: validation, formatting, dates, http, db, auth, errors, logging, config, testing.)

## Installed libraries
<name> <version>: what it is used for here, where (one path). Flag overlaps (two libs doing one job).

## Conventions
Errors, logging, config/env, auth checks, validation at boundaries, test layout, naming. One line each, with an example path.

## Security-relevant surfaces
Trust boundaries: auth middleware, input parsing, file/path handling, SQL/query builders, secrets loading, outbound calls with user input. path:line each.
```

**Done when** every source directory holding application logic is under a module, every helper a second module imports is listed, and every runtime dependency in the manifest is listed.

## 4. Report

One line: path written, full or incremental, and the counts (modules, helpers, libraries).
