# Changelog

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
