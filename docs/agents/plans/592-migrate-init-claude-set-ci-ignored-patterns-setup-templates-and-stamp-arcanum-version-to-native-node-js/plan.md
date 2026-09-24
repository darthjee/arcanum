# Plan: Migrate init-claude set-ci-ignored-patterns, setup-templates and stamp-arcanum-version to native Node.js

Issue: [592-migrate-init-claude-set-ci-ignored-patterns-setup-templates-and-stamp-arcanum-version-to-native-node-js.md](../../issues/592-migrate-init-claude-set-ci-ignored-patterns-setup-templates-and-stamp-arcanum-version-to-native-node-js.md)

## Overview

Route the three small `init-claude` entrypoints through `engine_dispatch`, following the #588 precedent: each original script becomes a thin shim, its body moves to a `*_shell.sh` file, and a native counterpart lands under `core/lib/commands/init-claude/`. The scripts keep their cwd-based public CLI; the shims pass `"$PWD"` as `repo_path` via `--prepend-repo-path` to `context: 'repo'` commands. The native side needs two new shared pieces: a native repo-config writer (`repo_config_write` / `repo_config_set_version` equivalents) and an install-version resolver extracted from `ArcanumUpdateRunUpdate.js`.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

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
