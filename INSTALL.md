# Installation

## Claude Code

Requirements: macOS/Linux/WSL shell, Git, Claude Code.

1. Clone the repository.
2. Run `./install.sh`.
3. Start a new Claude Code session.
4. Run `/engineering-guide status`.

The installer is designed for a global personal installation:

- skills -> `~/.claude/skills/`;
- global contract -> user-level Claude instructions;
- private state -> `~/.engineering-workflow/`;
- model mapping -> `~/.engineering-workflow/hosts/claude/models.yaml`.

No files are added to any application repository by the installer.
