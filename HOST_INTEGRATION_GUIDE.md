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

## Claude Code adapter

Claude Code supports personal skills under `~/.claude/skills/`, which makes the workflow global across projects. User-level instructions can live in `~/.claude/CLAUDE.md`. The installer uses those mechanisms; it does not add the workflow to target repositories.

Claude Code also supports a native `model` field in skill frontmatter. This repository keeps that host-specific field out of the portable source and injects it during installation from `hosts/claude/models.yaml`.

Current default profile mapping in this repository:

```yaml
strategic: opus
implementation: sonnet
```

Change the mapping in one place when your preferred model changes.

## Explicit invocation policy

All workflow skills are configured as explicit/user-triggered by default in the Claude adapter because they represent deliberate engineering stages or may have side effects. The orchestrator can recommend a next skill, but it must not silently turn a recommendation into a write action.

## Future adapters

A future Codex or other host adapter should map the same profiles and authority boundaries to its own model names, skill directory, permission system, and invocation mechanism. The portable skill body should not need to change merely because the host changes.
