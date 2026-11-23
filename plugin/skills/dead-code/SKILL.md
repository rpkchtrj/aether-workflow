---
name: dead-code
description: Find dead code (unused functions, types, classes, files, exports, dependencies) with hard evidence for each item, honour keep/deprecation comments, and verify removal by building and testing in a throwaway worktree. Reports only; deletes nothing in the repo. Use when the user asks for dead code, unused code, cleanup candidates, or what can be safely removed.
model: sonnet
argument-hint: "[path to scope, default: whole repo]"
---

# /dead-code

Finds code that can be removed **without changing behaviour**, and proves it. An item without hard evidence is never called safe. The report is the product; removal is the user's decision, done afterwards through `/aether-wfl:plan-change` (removals count against its slice budget too).

Read-only on the repo. Writes only the report, `<main-root>/.plans/dead-code-<YYYY-MM-DD>.md` (main root resolved as in `/aether-wfl:codemap`), and a throwaway worktree that is removed at the end.

## 1. Live roots

Code is dead only if nothing reachable from a live root uses it. List the roots first, from `.plans/CODEMAP.md` plus the repo:

- Program entry points: `main`, `init()`, server bootstrap, CLI commands, workers, cron and queue consumers, Lambda/serverless handlers.
- Framework conventions that call code by location or name: file-based routes (Next.js `app/`, `pages/`), decorators and annotations (`@Controller`, `@Injectable`, `@app.route`), DI registration, plugin registries, middleware lists.
- Anything referenced from outside the source: `package.json` scripts and `bin`/`main`/`exports`, Dockerfiles, CI configs, Makefiles, infra/serverless configs, templates, SQL, cron files.
- **Public API**: exports of a published library (`package.json` without `"private": true`, a Go module other repos import). These may have callers outside the repo; they can never be **safe**.
- **Externally called surfaces**: HTTP routes, webhooks, RPC methods, event and queue handlers. Clients outside the repo call them, so no in-repo caller proves nothing. A registered route is live, not dead.

## 2. Candidates

Use static tools that are **already installed**: never install one without asking (`npx <tool>` downloads, so it counts).

| Stack | Tools, in order of preference |
|---|---|
| TS/JS | `knip`, `ts-prune`, `tsc --noUnusedLocals --noUnusedParameters --noEmit` |
| Go | `deadcode ./...` (golang.org/x/tools), `staticcheck -checks U1000 ./...` |
| Python | `vulture` |
| Any | LSP find-references on every exported symbol in scope; unused entries in the dependency manifest |

No tool available: say so in the report, then use LSP references across exported symbols. Tool output is a **candidate list**, not evidence.

## 3. Evidence, per candidate

Collect all of these and record each result:

1. **References**: LSP find-references, zero outside its own definition (and outside tests, recorded separately).
2. **Text search** for the name across the **whole** repo, including non-code files (configs, YAML, JSON, templates, SQL, HTML, env examples, scripts). A string hit means possible dynamic use until read and ruled out.
3. **Dynamic access** in the same module or its consumers: reflection, `getattr`/`globals()`, `obj[name]`, dynamic `import()`/`require(var)`, `reflect`, DI tokens by string, serializer field names and struct tags, ORM models and columns, i18n keys.
4. **Side effects**: a file whose top level registers something (routes, metrics, handlers, polyfills, `init()`) is live if it is imported anywhere, even when none of its symbols are used.
5. **Comments and markers** on or around the symbol (step 4).
6. **History**: `git log -S <name> --oneline -5` for when it lost its last caller, and whether a recent commit added it ahead of planned use.

## 4. Comments and markers

Read the comment block above each candidate and any marker on it:

- **Keep markers** (`keep`, `do not remove`, `used by <x>`, `public API`, `@public`, `//export`, `//go:linkname`, `//nolint:unused`, `eslint-disable … no-unused`, `# noqa`, `@ts-expect-error` hiding an unused import, `@SuppressWarnings("unused")`): classify **Keep**, quote the marker. A marker that names a consumer which no longer exists is reported as **Keep (marker looks stale)**, quoting both, for the user to decide.
- **`@deprecated`**: deprecated is not dead. No in-repo callers and not public API: **Likely dead**, quote the deprecation note. Still has callers: not listed.
- **Removal notes** (`TODO: remove after <date/flag/version>`): check the condition. Met, with the evidence above: eligible for **Safe**. Not met: **Keep**, with the condition.
- **Feature-flagged code**: live while the flag can be on. **Likely dead** only if the flag is removed or hard-coded off everywhere, with the evidence.

## 5. Verify removal

Only candidates with zero references, no dynamic-access hits, no side effects, no keep marker and not a live root go to verification.

1. `git worktree add --detach <tmpdir> HEAD`. All work happens there.
2. Remove every verification candidate at once. Run the repo's build, typecheck, lint and full test suite (use only what is installed locally; no dependency installs or network).
3. Green: all are verified. Red: bisect the set (halve, rerun) until each failure is attributed; the failing items drop to **Likely dead** with the failure quoted.
4. **Cascade**: after a green run, rerun the tools in the worktree. Newly unused code (only the removed code used it) is a cascade item: verify it the same way, and report it with the item it depends on.
5. `git worktree remove --force <tmpdir>`.

Build or tests can't run here (missing deps, needs services): nothing can be **Safe**; verified-by-reading items are capped at **Likely dead** and the report says why. A green test run proves the build holds, not that behaviour is unchanged; the zero-reference evidence is what proves that, so both are required.

## 6. Classify

| Class | Requires |
|---|---|
| **Safe to remove** | Zero references, zero text or dynamic hits (or each hit read and ruled out), no side effects, not a live root or public API, no keep marker, **and** a green verification run. |
| **Test-only** | Referenced only by tests. Removing it deletes those tests too. User decides. |
| **Likely dead** | Evidence points to dead, but one item can't be ruled out: a dynamic-access pattern, a string hit, possible external callers, a flag, a stale marker, or verification couldn't run. Name the open item. |
| **Keep** | A keep marker or an unmet removal condition. Quoted. |

Unused **dependencies**: listed in the manifest, no import anywhere, not referenced by scripts or configs (CLI tools, plugins, type packages, peer deps). Verified the same way: remove from the manifest in the worktree and rebuild, without a network install.

## 7. Report

Written to the report file and summarised in chat:

```markdown
# Dead code: <repo> @ <short sha>, <YYYY-MM-DD>
Tools: <what ran> | Not available: <what didn't>
Verification: <commands run> -> <result>

## Safe to remove (N items, ~L lines)
1. `path:line` `symbol` (function/type/file/export/dependency)
   - Evidence: refs 0 (LSP) · text hits 0 · no dynamic access · no side effects · no marker · verified green
   - Lost its last caller: <commit sha, subject> (if found)
   - Cascade: also frees <items>

## Test-only
## Likely dead (open item named per entry)
## Keep (marker quoted)

## Security note
Dead-looking code that is still reachable: registered routes or handlers with no in-repo caller, old auth paths, debug endpoints. These are live attack surface, not dead code. Listed here for `/security-audit`.
```

End with one line: the suggested next step, usually `/aether-wfl:plan-change remove the Safe items in <report path>`.
