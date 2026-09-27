# Host Adapters

The portable `skills/` directory defines engineering roles and authority boundaries. A host adapter maps those roles onto one agent's skill discovery, naming, invocation, and model mechanisms.

An adapter is **data, not code**: a `hosts/<name>/host.yaml` file. Adding an agent does not require changing `lib/`.

## Namespacing

Skills need a stable `aether-wfl` prefix so they don't collide with unrelated skills. There is no cross-agent convention for this, so each adapter declares which of two mechanisms its host provides:

| `namespace` | Meaning | Emitted skill name |
|---|---|---|
| `plugin` | The host derives a namespace from a plugin manifest name | canonical (`engineering-guide`) |
| `name-prefix` | The host has one flat skill namespace | prefixed (`aether-wfl-engineering-guide`) |

A `plugin` host must not also prefix the name, or the prefix appears twice.

## Current adapters

| Directory | Namespace | Target | Invocation |
|---|---|---|---|
| `claude-plugin/` | `plugin` | `~/.engineering-workflow/plugin` | `/aether-wfl:<skill>` |
| `claude-flat/` | `name-prefix` | `~/.claude/skills` | `/aether-wfl-<skill>` |
| `codex/` | `name-prefix` | `~/.agents/skills` | `$aether-wfl-<skill>` |
| `generic/` | `name-prefix` | `--target <dir>` | host-specific |

`claude/models.yaml` is not an adapter. It is the shared Claude model-profile mapping that both Claude adapters reference through their `model_map` key.

## host.yaml keys

| Key | Required | Purpose |
|---|---|---|
| `name` | yes | Adapter id, must match the directory name |
| `namespace` | yes | `plugin` or `name-prefix` |
| `prefix` | yes | Namespace prefix, lowercase and hyphenated |
| `target` | yes | Install directory. Supports `~`, `${CLAUDE_HOME}`, `${WORKFLOW_HOME}`, `${TARGET}` |
| `frontmatter_keys` | yes | Ordered allowlist of frontmatter keys to emit |
| `skills_subdir` | plugin hosts | Path below `target`, shaped `plugins/<plugin>/skills` |
| `model_map` | no | Model mapping file relative to `hosts/`, e.g. `claude/models.yaml` |
| `register` | no | `claude-cli` to register the generated marketplace |
| `invocation` | no | Display string, `<skill>` is substituted |
| `description` | no | Shown by `aether hosts` |

`frontmatter_keys` is an allowlist, not a filter: a host receives only the keys it names. This is what keeps Claude's `model` and `disable-model-invocation` out of a Codex install.

## Adding an agent

1. Confirm how the agent discovers skills and whether it namespaces them. Do not assume a plugin format implies a namespace — Codex has plugins but still references skills by bare `name`.
2. Write `hosts/<name>/host.yaml`.
3. `node bin/aether.js install --host <name> --dry-run`.
