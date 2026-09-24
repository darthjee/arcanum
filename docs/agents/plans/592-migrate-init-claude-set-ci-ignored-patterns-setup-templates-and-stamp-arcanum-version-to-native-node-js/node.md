# Node Plan: Migrate init-claude set-ci-ignored-patterns, setup-templates and stamp-arcanum-version to native Node.js

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

## Steps

- [01 — Extract the install-version resolver](node/01-extract-install-version.md)
- [02 — Add a native repo-config writer](node/02-repo-config-writer.md)
- [03 — Implement the three init-claude commands](node/03-init-claude-commands.md)
- [04 — Register the commands](node/04-register-commands.md)
- [05 — Parity specs](node/05-parity-specs.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`) — also enforces the one-way `commands` → `utils` import direction.

## Notes

- Zero runtime dependencies.
- Unit specs mirror `core/lib/` 1:1 under `core/spec/lib/`.
- Keep `ArcanumUpdateRunUpdate` behavior unchanged. Its existing specs must pass untouched, except where they stub collaborators that moved.
