# Model Profiles

Model selection is deliberately separated from engineering role definitions. Skills declare a profile; each host maps that profile to a concrete model.

## Default profiles

| Profile | Purpose | Claude Code default |
|---|---|---|
| `strategic` | requirements, planning, architecture, security, distributed reasoning, incident diagnosis, senior review | `opus` |
| `implementation` | coding, routine verification, runtime-focused implementation, controlled experiments | `sonnet` |

## Change policy

Do not edit 16 skills when a model changes. Update the host adapter mapping. For Claude Code, edit `hosts/claude/models.yaml` and reinstall/update.

The `model` frontmatter used by Claude Code is a host-specific extension. The portable skill uses `metadata.workflow_model_profile` so other Agent Skills hosts can apply their own model mechanism.
