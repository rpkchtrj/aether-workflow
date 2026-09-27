# Installation

## Claude Code

Requirements: Node.js 18+, Claude Code. Git is needed only for per-project private state.

```bash
npx aether-workflow@latest install
```

Then:

1. Start a new Claude Code session.
2. Run `/engineering-guide status`.

Preview the exact targets without writing anything:

```bash
npx aether-workflow@latest install --dry-run
```

The installer is designed for a global personal installation:

- skills -> `~/.claude/skills/`;
- global contract -> user-level Claude instructions (`~/.claude/CLAUDE.md`, backed up before edit);
- private state -> `~/.engineering-workflow/`;
- model mapping -> `~/.engineering-workflow/hosts/claude/models.yaml`.

No files are added to any application repository by the installer.

## Commands

| Command | Purpose |
|---|---|
| `npx aether-workflow install [--dry-run]` | Install or upgrade |
| `npx aether-workflow verify` | Check an existing installation |
| `npx aether-workflow uninstall [--purge-state]` | Remove skills and the contract import |
| `npx aether-workflow init-project` | Create private state for the current repository |
| `npx aether-workflow project-id` | Print the current repository's project id |

## Overrides

| Variable | Default | Purpose |
|---|---|---|
| `ENGINEERING_WORKFLOW_HOME` | `~/.engineering-workflow` | Private state location |
| `CLAUDE_HOME` | `~/.claude` | Claude Code home |

## Upgrading

Re-run `npx aether-workflow@latest install`. The install is idempotent: skills are rewritten against the current `models.yaml`, and the `CLAUDE.md` import is only appended when absent. Private project state under `~/.engineering-workflow/projects/` is never touched.

## Installing from a clone

```bash
node bin/aether.js install
```

`./install.sh` is kept as a deprecated shim that forwards to the same Node installer.
