# Host Integration Guide

The engineering rules are portable. Host integration supplies skill discovery, invocation, permissions, model selection, tool access, and optional orchestration.

## Portable layer

`skills/*/SKILL.md` contains the role, mission, hard rules, workflow, inputs, outputs, and authority boundaries. Each skill also declares a portable `workflow_model_profile` metadata value such as `strategic` or `implementation`.

## Host adapter layer

A host adapter maps:

- where skills are installed/discovered;
- how a skill is manually invoked;
- whether automatic skill selection is permitted;
- how write permissions are controlled;
- how model profiles map to concrete models;
- whether subagents/forks are used.

## Namespacing

Skills carry an `aether-wfl` prefix so they do not collide with unrelated skills. No cross-agent convention exists for this, so an adapter declares one of two mechanisms in `namespace`:

- `plugin` - the host derives a namespace from a plugin manifest name, so emitted skill names stay canonical;
- `name-prefix` - the host has one flat namespace, so the prefix is baked into the emitted directory and the frontmatter `name`.

A plugin format does not imply a namespace. Codex has a plugin format but still references skills by bare `name`, so the Codex adapter is `name-prefix`.

## Claude Code adapter

Two adapters ship for Claude Code. `claude-plugin` (default) generates a plugin under `~/.engineering-workflow/plugin/` and registers it with the `claude` CLI, which supplies the `aether-wfl:` prefix from the plugin manifest name. `claude-flat` installs into `~/.claude/skills/` for when the plugin route is unavailable, and bakes the prefix into the name instead.

User-level instructions live in `~/.claude/CLAUDE.md`. The installer uses those mechanisms; it does not add the workflow to target repositories.

Claude Code also supports a native `model` field in skill frontmatter. This repository keeps that host-specific field out of the portable source and injects it during installation from `hosts/claude/models.yaml`. Because the plugin is generated locally at install time rather than shipped pre-built, that mapping stays editable per machine.

Each adapter declares `frontmatter_keys` as an allowlist, so a host only ever receives keys it understands: `model` and `disable-model-invocation` reach the Claude adapters and not the Codex one.

Current default profile mapping in this repository:

```yaml
strategic: opus
implementation: sonnet
```

Change the mapping in one place when your preferred model changes.

## Explicit invocation policy

All workflow skills are configured as explicit/user-triggered by default in the Claude adapter because they represent deliberate engineering stages or may have side effects. The orchestrator can recommend a next skill, but it must not silently turn a recommendation into a write action.

## Codex adapter

Verified 2026-09-27 against the official Codex skills documentation. Codex discovers skills in `.agents/skills` (repository, walking up to the repo root), `$HOME/.agents/skills` (user), `/etc/codex/skills` (admin), and bundled system skills. Skills are invoked as `$<name>` in the CLI or `@<name>` in ChatGPT, referenced directly by their frontmatter `name` with no namespace prefix.

Only the user-level location is written. Writing the repository-level `.agents/skills` would modify an application repository, which the contract forbids.

## Future adapters

A further adapter should map the same profiles and authority boundaries to its own model names, skill directory, permission system, and invocation mechanism. The portable skill body does not change when the host changes; cross-references between skills are rewritten at emission time for name-prefix hosts. Adding an adapter is a `hosts/<name>/host.yaml` file, not a code change - see `hosts/README.md`.
