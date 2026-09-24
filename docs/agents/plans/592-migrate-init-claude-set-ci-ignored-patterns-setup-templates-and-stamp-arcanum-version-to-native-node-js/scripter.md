# Scripter Plan: Migrate init-claude set-ci-ignored-patterns, setup-templates and stamp-arcanum-version to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

### Command names, modules and registry entries

| Command (`migration-status.json` key / `core/bin/arcanum` name) | Shim (unchanged public CLI) | Shell implementation | Native module (`core/lib/`) |
| --- | --- | --- | --- |
| `init-claude-set-ci-ignored-patterns` | `init-claude/scripts/set_ci_ignored_patterns.sh` | `init-claude/scripts/set_ci_ignored_patterns_shell.sh` | `commands/init-claude/InitClaudeSetCiIgnoredPatterns.js` |
| `init-claude-setup-templates` | `init-claude/scripts/setup_templates.sh` | `init-claude/scripts/setup_templates_shell.sh` | `commands/init-claude/InitClaudeSetupTemplates.js` |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | `init-claude/scripts/stamp_arcanum_version_shell.sh` | `commands/init-claude/InitClaudeStampArcanumVersion.js` |

Each registry entry in `core/lib/core/commands.js`: `{ module, method: 'run', context: 'repo', validateRepoPath: false }`.

### Invocation

- Shim: `REPO_PATH="$PWD"` (NOT `git rev-parse --show-toplevel` — the shell implementations write relative to cwd, so parity requires the literal cwd), then
  `engine_dispatch "$REPO_PATH" <command> "${SCRIPT_DIR}/<name>_shell.sh" --prepend-repo-path [HOME] -- "$@"` (precedent: `discuss-issue/scripts/render_issue.sh`).
- Native therefore receives `core/bin/arcanum <command> <repo_path> <original args...>`; the dispatcher strips `<repo_path>` into `RepoContext.repoPath`. Native code resolves every target-project path against `repoPath`, never `process.cwd()`.
- `validateRepoPath: false` because the shell scripts never required the target project to be a git repo — the Dispatcher's git-repo validation would be a new failure mode.
- Env allowlist: none for `set-ci-ignored-patterns` / `setup-templates`; `HOME` for `stamp-arcanum-version` (it runs `git describe`, same reasoning as `auto-new-issue/scripts/commit_issue.sh`).
- The `_shell.sh` files live in the same directory as the originals, so their own `SCRIPT_DIR/../..` install-root and `SCRIPT_DIR/../templates` resolution is unchanged. Native resolves the same install via `INSTALL_ROOT` / `resolveInstallPath` from `core/lib/utils/file/InstallRoot.js` (engine_dispatch always runs the `core/bin/arcanum` of the same install as the shim).

### Output / exit-code contracts (identical in both modes)

- `set-ci-ignored-patterns`: zero args → shim prints `Usage: $0 <pattern-1> [<pattern-2> ...] | --clear` to stderr, exit 1 (shim-only; never reaches either engine). Exactly one arg `--clear` → writes `[]`. Otherwise writes the args as a JSON string array — note the shell's `printf '%s\n' "$@" | jq -R .` splits any arg containing `\n` into several elements; native must reproduce that (`args.flatMap(a => a.split('\n'))`). `--clear` mixed with other args is just a literal pattern. No stdout, exit 0.
- `setup-templates`: `mkdir -p .github`; for `pull_request_template.md`, `commit_message_template.md`, `commit_message_template-2.0.md` in that order, copy from `<install>/init-claude/templates/` if `.github/<name>` is not a regular file. Prints `Created: <names space-joined>` (if any), then `Already present, left untouched: <names space-joined>` (if any), each with a trailing newline. Exit 0.
- `stamp-arcanum-version`: no output, always exit 0. Version = `<install>/arcanum.json` `.version` if that file exists (unreadable/malformed/missing field → empty), else `git -C <install> describe --tags --exact-match` if `<install>/.git` exists (failure → empty). Only when it matches `^[0-9]+\.[0-9]+\.[0-9]+$`: set `.version` in `.claude/configuration/arcanum-repo-config.json`, then `.migrations.version` in `.claude/state/arcanum-config.json`.

### Config file writes

- Must be byte-identical to jq's default output: `JSON.stringify(obj, null, 2) + '\n'`, existing key order preserved, new keys appended. An existing file that is not valid JSON is treated as `{}` (as the shell does). Parent dirs created as needed. Atomic write via `<file>.tmp` + rename.
- Locking: `<file>.lock` through the existing `core/lib/utils/file/Lock.js` (same protocol as `arcanum/_lib/lock.sh`, so shell and native writers exclude each other).
- `repo_config_write` semantics: under the lock, first seed — if `<new_file>` lacks `.<namespace>` and `<legacy_file>` exists, set `.<namespace>` = full legacy contents — then set `.<namespace>.<key> = <value>`.

## Implementation Steps

### Step 1 — Split each script into a `*_shell.sh` implementation + thin `engine_dispatch` shim

For each of `set_ci_ignored_patterns.sh`, `setup_templates.sh` and `stamp_arcanum_version.sh`:

- Copy (`git mv` + recreate) the current body verbatim into `<name>_shell.sh` in the same directory, keeping its header comment (it becomes the behavior-contract reference). Make it executable.
- Rewrite the original as a thin shim modelled on `discuss-issue/scripts/render_issue.sh` and `auto-new-issue/scripts/commit_issue.sh`: a header explaining the migration and the `"$PWD"` → `--prepend-repo-path` choice (the scripts run from the target project root and never took a `<repo_path>`; native must not read `process.cwd()`, per `docs/agents/architecture/repo-path-threading.md`), `REPO_PATH="$PWD"`, then `engine_dispatch` with the env allowlist from the shared contracts (`HOME` only for stamp).
- `set_ci_ignored_patterns.sh` keeps the zero-args usage check in the shim, before `engine_dispatch`, so the error is identical in both modes.
- Do not change any `init-claude/*.md` step file — the public CLI is unchanged.

### Step 2 — Mark the commands migrated

In `arcanum/_lib/migration-status.json`, flip `init-claude-set-ci-ignored-patterns`, `init-claude-setup-templates` and `init-claude-stamp-arcanum-version` to `true`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` with `scripts/generate_entrypoint_migration_status.sh`. Do this only once the node agent's registry entries exist, so `native` mode never routes to an unregistered command.

## Files to Change

- `init-claude/scripts/set_ci_ignored_patterns.sh` — becomes the shim (keeps the usage check).
- `init-claude/scripts/set_ci_ignored_patterns_shell.sh` — new; the former implementation.
- `init-claude/scripts/setup_templates.sh` — becomes the shim.
- `init-claude/scripts/setup_templates_shell.sh` — new; the former implementation.
- `init-claude/scripts/stamp_arcanum_version.sh` — becomes the shim (forwards `HOME`).
- `init-claude/scripts/stamp_arcanum_version_shell.sh` — new; the former implementation.
- `arcanum/_lib/migration-status.json` — three keys flipped to `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.

## CI Checks

- `core`: `yarn test` (CI job: `test`) — the node agent's parity specs call the `_shell.sh` files directly.

## Notes

- Manually verify routing: in a scratch dir, run each shim with `engine.mode=shell` and `engine.mode=native` and diff stdout/stderr/exit code and the resulting files.
- `stamp_arcanum_version_shell.sh` must keep resolving the install root as `SCRIPT_DIR/../..`. That still holds because it stays in `init-claude/scripts/`.
