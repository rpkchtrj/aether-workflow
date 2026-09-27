# Installation

Requirements: Node.js 18+. Git is needed only for per-project private state.

## Claude Code (default)

```bash
npx aether-workflow@latest install
```

Then start a new session and run `/aether-wfl:engineering-guide status`.

This generates a plugin under `~/.engineering-workflow/plugin/` and registers it with the `claude` CLI. Claude Code derives the `aether-wfl:` prefix from the plugin manifest name.

If the `claude` CLI is not on `PATH`, registration is skipped and reported; fall back to:

```bash
npx aether-workflow@latest install --host claude-flat   # /aether-wfl-engineering-guide
```

## Other agents

```bash
npx aether-workflow@latest hosts                         # list adapters
npx aether-workflow@latest install --host codex          # $aether-wfl-engineering-guide
npx aether-workflow@latest install --host generic --target <dir>
```

Any agent that discovers skills as `<dir>/SKILL.md` folders is supported by `--host generic`. See `hosts/README.md` to add a first-class adapter — it is a `host.yaml` file, not code.

## Naming

There is no cross-agent prefix convention. Hosts with a plugin namespace (Claude Code) supply `aether-wfl:` themselves; hosts with one flat namespace (Codex, plain skill directories) get the prefix baked into the skill name as `aether-wfl-`. Either way the prefix is always present.

Preview the exact targets without writing anything:

```bash
npx aether-workflow@latest install --dry-run
```

The installer is designed for a global personal installation:

- skills -> the selected host's target;
- global contract -> user-level Claude instructions (`~/.claude/CLAUDE.md`, backed up before edit);
- private state -> `~/.engineering-workflow/`;
- model mapping -> `~/.engineering-workflow/hosts/claude/models.yaml`;
- install record -> `~/.engineering-workflow/install.json`.

No files are added to any application repository by the installer. Codex reads a repo-level `.agents/skills` directory, but only the user-level location is ever written.

## Commands

| Command | Purpose |
|---|---|
| `npx aether-workflow install [--host <host>] [--target <dir>] [--no-register] [--dry-run]` | Install or upgrade |
| `npx aether-workflow hosts` | List host adapters |
| `npx aether-workflow verify [--host <host>]` | Check an existing installation |
| `npx aether-workflow uninstall [--purge-state]` | Remove skills and the contract import |
| `npx aether-workflow init-project` | Create private state for the current repository |
| `npx aether-workflow project-id` | Print the current repository's project id |

## Overrides

| Variable | Default | Purpose |
|---|---|---|
| `ENGINEERING_WORKFLOW_HOME` | `~/.engineering-workflow` | Private state location |
| `CLAUDE_HOME` | `~/.claude` | Claude Code home |

## Upgrading

Re-run `npx aether-workflow@latest install`. The install is idempotent: skills are re-emitted against the current `models.yaml`, and the `CLAUDE.md` import is only appended when absent. Private project state under `~/.engineering-workflow/projects/` is never touched.

Upgrading from a version before namespacing also removes the old unprefixed skills from `~/.claude/skills/`, so the two layouts never coexist. Unrelated skills in that directory are left alone.

## Installing from a clone

```bash
node bin/aether.js install
```

`./install.sh` is kept as a deprecated shim that forwards to the same Node installer.
