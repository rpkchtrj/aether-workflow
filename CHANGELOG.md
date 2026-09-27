# Changelog

## 1.3.0

- Skills are now namespaced under `aether-wfl`. Claude Code installs as a generated plugin (`/aether-wfl:engineering-guide`); hosts with a flat skill namespace get the prefix baked into the skill name (`aether-wfl-engineering-guide`).
- Host adapters are declarative. `hosts/<name>/host.yaml` describes a host's namespace mechanism, target directory and frontmatter allowlist; adding an agent needs no code change.
- Added `claude-plugin` (default), `claude-flat`, `codex` and `generic` adapters, and `aether hosts` to list them.
- `install` takes `--host`, `--target` and `--no-register`. The default host registers its generated marketplace through the `claude` CLI and falls back with a reported reason if the CLI is absent.
- Frontmatter is rebuilt per host from an allowlist, so Claude's `model` and `disable-model-invocation` no longer reach hosts that do not understand them.
- Cross-references between skills are rewritten on name-prefix hosts so a prefixed install does not point at names that do not exist there.
- Upgrading removes the pre-namespacing unprefixed skills; unrelated skills sharing the directory are left untouched. `verify` fails if both layouts are present.
- `install.json` records the host that ran, so `verify` and `uninstall` act on it rather than the default.

## 1.2.1 - Release Pipeline Validation
- No functional change. First release published through GitHub Actions Trusted Publishing (OIDC), validating the pipeline end to end.
- `npm version` now keeps `VERSION` in sync with `package.json` automatically.

## 1.2.0 - One-Command Install
- Published as the `aether-workflow` npm package: `npx aether-workflow@latest install`. Cloning the repository is no longer required.
- Ported the installer from Bash + inline Python to dependency-free Node (18+), removing the undeclared `python3` requirement and the macOS/Linux/WSL-only constraint.
- Added `verify`, `uninstall`, `init-project` and `project-id` as CLI subcommands, plus `install --dry-run` to preview every target before writing.
- Skill list is now discovered from the package payload instead of hardcoded in three shell scripts, so adding a skill no longer needs matching edits in the installer, uninstaller and verifier.
- Added a test suite covering install, idempotent reinstall, dry run, uninstall, state purge, verification failure and frontmatter rewriting.
- `install.sh`, `scripts/uninstall.sh` and `scripts/verify-install.sh` are deprecated shims that forward to the Node CLI.

## 1.1.0 - Global Personal Workflow
- Moved private workflow state outside target repositories.
- Made the system explicitly personal/global rather than a team repository convention.
- Added Claude host adapter with centralized model profiles.
- Added install/update/uninstall/verification scripts.
- Added model metadata to every skill.
- Strengthened explicit `GO` write authorization.
- Made documentation guardian aware of branch-sync drift and shared-vs-private documentation.
- Kept risk-based routing with security always-on.
