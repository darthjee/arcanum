# Issue: Migrate init-claude set-ci-ignored-patterns, setup-templates and stamp-arcanum-version to native Node.js

## Description

Sub-issue A of #585. Migrate the three small, self-contained `init-claude` entrypoints to native Node.js:

| Command | Script | Lines | Notes |
| --- | --- | --- | --- |
| `init-claude-set-ci-ignored-patterns` | `init-claude/scripts/set_ci_ignored_patterns.sh` | 38 | Writes `auto-fix-all.ignored_check_patterns` via `repo_config_write` (lock-protected, seeds from the legacy `.claude/configuration/auto-fix-all.json`) |
| `init-claude-setup-templates` | `init-claude/scripts/setup_templates.sh` | 27 | Copies the `.github/` templates from the install's `init-claude/templates/`, skipping ones already present |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | 55 | Resolves the install version (zip `arcanum.json` / exact git tag) and stamps both `.claude/configuration/arcanum-repo-config.json` `.version` and `.claude/state/arcanum-config.json` `.migrations.version` |

## Expected Behavior

All three route through `engine_dispatch`, with stdout/stderr/exit codes and resulting files identical in `engine.mode=native` and `shell`, and their `migration-status.json` keys flip to `true`.

### Constraints

- These run from the target project root (cwd), not from a `<repo_path>` argument, and their public CLI stays that way (no change to the `init-claude` step `.md` files). Each shim forwards `"$PWD"` as the `repo_path` to a `context: 'repo'` native command, so the native code never reads `process.cwd()` (per `repo-path-threading.md`). Document this in each shim.
- Two of the three also need the arcanum **install root**: `setup_templates.sh` reads `init-claude/templates/`, and `stamp_arcanum_version.sh` resolves the version relative to `<script_dir>/../..`. The native side must resolve the same install root (e.g. via `ClaudeContext.installRoot()` / `InstallRoot.js`).
- `stamp_arcanum_version.sh` is a silent no-op (exit 0) when the version is not valid `X.Y.Z` semver — the native version keeps that contract. Its resolution order is: `arcanum.json` `.version` if present, else `git describe --tags --exact-match` if `.git` exists — **no** short-hash fallback.
- Reuse the version-resolution logic in `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` (#263) instead of duplicating it — but note its `_currentVersion` falls back to `git rev-parse --short HEAD`, which stamping must not do. Extract the shared part (zip version / exact tag) to a util under `core/lib/utils/`, with the short-hash fallback staying in `arcanum-update`.
- `utils/config/RepoConfig.js` is read-only today. The native `set-ci-ignored-patterns` and `stamp-arcanum-version` need native equivalents of `repo_config_write` (with legacy-file seeding) and `repo_config_set_version` (optional namespace), using the existing native `Lock` on the same `<file>.lock` so shell and native writers never race.

## Solution

Follow `docs/agents/architecture/script-engine.md` and the precedent of #588 (per-command `*_shell.sh` + thin `engine_dispatch` shim) and #261 (multi-subcommand split).

1. Read each source script for its exact stdout/stderr/exit-code contract.
2. **scripter:** move each implementation into a `*_shell.sh` file and make the original script a thin `engine_dispatch` shim with a minimal per-command env-var allowlist (none of these need `gh`, so no `HOME`). Argument/usage errors (e.g. `set_ci_ignored_patterns.sh` with no args) stay in the shim so they are identical in both modes.
3. **node:** implement the native command(s) under `core/lib/commands/init-claude/` with zero runtime deps. In this same issue (not a separate prerequisite), add native repo-config write/set-version support alongside `utils/config/RepoConfig.js` (reusing the native `Lock`), and the shared install-version util extracted from `ArcanumUpdateRunUpdate.js`.
4. Register each command in `core/lib/core/commands.js`.
5. In `arcanum/_lib/migration-status.json`, replace the relevant `false` key(s) with one `true` key per dispatched command name, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
6. Add native unit specs mirroring `core/lib/` 1:1, plus a shell-vs-native parity spec per command.
7. Verify `engine_dispatch.sh` routing under both `engine.mode=native` and `shell`.
