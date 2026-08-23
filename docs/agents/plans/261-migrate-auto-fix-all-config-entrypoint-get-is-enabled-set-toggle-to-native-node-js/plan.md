# Plan: Migrate auto-fix-all-config entrypoint (get, is-enabled, set, toggle) to native Node.js

Issue: [261-migrate-auto-fix-all-config-entrypoint-get-is-enabled-set-toggle-to-native-node-js.md](../issues/261-migrate-auto-fix-all-config-entrypoint-get-is-enabled-set-toggle-to-native-node-js.md)

## Overview

`auto-fix-all/scripts/config.sh` (4 subcommands: `get`, `is-enabled`, `set`, `toggle`) migrates to native Node.js per `docs/agents/architecture/script-engine.md`, following the same "multiple subcommands → one module, one `COMMANDS` entry per subcommand" shape already used for `github-issue-info`/`github-issue-create` (both mapping to `GithubIssue.js`) — including that precedent's choice of dedicated per-subcommand `*_shell.sh` files over one shared shell script (see "Why `config.sh` splits into 4 dedicated `*_shell.sh` files" below for why that's required here, not just stylistic). `node` builds `core/lib/AutoFixAllConfig.js` and wires it into `core/bin/arcanum`; `scripter` turns `config.sh` into a thin per-subcommand `engine_dispatch` shim, splits its old body into the 4 dedicated shell scripts, and flips the migration-status flags. `skill-writer` updates the 3 existing call sites that invoke `config.sh` today without a `repo_path` argument (see "New CLI signature" below) — a gap the issue body didn't mention, found by checking every caller of `auto-fix-all/scripts/config.sh` across the repo's skill `.md` files.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

- **Command names** (must match exactly across `core/bin/arcanum`'s `COMMANDS` map, the `config.sh` shim's `engine_dispatch` calls, and `migration-status.json`'s keys):
  - `auto-fix-all-config-get`
  - `auto-fix-all-config-is-enabled`
  - `auto-fix-all-config-set`
  - `auto-fix-all-config-toggle`

- **`migration-status.json` keys — correction to the issue body**: the issue text says to add a single `"auto-fix-all-config": true` key. That's inconsistent with how `engine_dispatch`'s `_engine_dispatch_native_available <command>` actually looks up the *exact* command name being dispatched, and with the established precedent for other multi-subcommand entrypoints (`github-issue-info`/`github-issue-create` each have their own key, both `true`). This plan instead adds **four separate keys**, one per subcommand above, each set to `true` (all four ship together in this one issue, so there's no partial-migration case to represent).

- **Spec file location — correction to the issue body**: the issue text says `core/spec/AutoFixAllConfig_spec.js`. Actual convention (script-engine.md: "`core/spec/` mirrors `core/lib/` 1:1") and every existing migrated module (see `core/spec/lib/AutoFixAllCheckoutFromMain_spec.js`, `core/spec/lib/GithubIssue_spec.js`, etc.) puts it at **`core/spec/lib/AutoFixAllConfig_spec.js`**. The parity spec goes under `core/spec/bin/`, named `autoFixAllConfigParity_spec.js` (camelCase, matching `autoFixAllCheckoutFromMainParity_spec.js`).

- **File/namespace resolution** (re-derived natively from `arcanum/_lib/repo_config.sh` + `auto-fix-all/scripts/config.sh`'s own `_new_file_for_key`/`_legacy_file_for_key`, since `repo_config.sh` itself has no native equivalent yet — `core/lib/RepoConfig.js` only covers unrelated single-tier reads of `git.safe_branch` and `plan-issues.*`, not this general namespace read/write logic):
  - Namespace: `auto-fix-all`.
  - Keys `clear_context` and `finish_on_empty_queue` → new file `.claude/state/arcanum-config.json`, **no legacy fallback**.
  - Every other key → new file `.claude/configuration/arcanum-repo-config.json`, legacy fallback `.claude/configuration/auto-fix-all.json`.
  - New-file read: value present at `.<namespace>.<key>` (presence-checked — a value of `false` still counts) wins. Otherwise, if a legacy file applies and has `<key>` at its top level, use that (a real implementation may skip the legacy-file stderr warning `repo_config_read` prints — that's shell-only ergonomics, not part of the stdout/exit-code contract). Otherwise the caller's own default applies (`"false"` for `get`/`is-enabled`).
  - Writes (`set`/`toggle`) always go to the new file, seeding `.<namespace>` from the legacy file first if the new file doesn't have that namespace yet (mirrors `repo_config_seed`), and must take the same lock-file protocol `arcanum/_lib/lock.sh`/`core/lib/Lock.js` already implements (`<new_file>.lock`) — concurrent `auto-fix-all` config writes are a real scenario (multiple queued issues touching shared config), so this isn't optional hardening.

- **Per-subcommand output/exit-code contract** (byte-identical stdout + exit code is the hard requirement per script-engine.md; stderr is not required to match verbatim — see `set`'s error case below):
  - `get <key>`: stdout is `<value>\n` (default `"false"` when absent anywhere), exit 0.
  - `is-enabled <key>`: **no stdout**, exit 0 when the resolved value is `"true"`, exit 1 otherwise. Native: return nothing (falls through to no stdout, exit 0) when true; `throw new DispatchFailure('', 1)` when false — the "print to stdout, still fail" shape from `core/lib/DispatchFailure.js`, with an empty stdout payload.
  - `set <key> true|false`: no stdout on success, exit 0. Missing args or a value that isn't exactly `true`/`false` is a real error: throw a plain `Error` with the same message text the shell prints (`Error: set requires a key and a value (true|false)` / `Error: value must be 'true' or 'false'`) — `core/bin/arcanum`'s dispatcher writes this to stderr prefixed with `arcanum: `, which differs from the shell's unprefixed stderr line; that's expected and out of scope for parity (stdout/exit code only).
  - `toggle <key>`: stdout is `<new_value>\n` (the flipped value), exit 0.

- **No env-var allowlist needed**: like `auto-fix-all-checkout-from-main`, this is pure local filesystem I/O scoped by `repo_path` — no `engine_dispatch` env-var forwarding required for any of the four subcommands.

- **New CLI signature — a gap not mentioned in the issue body**: `engine_dispatch` requires an explicit `repo_path` as its own first argument (for `config_chain_read`'s `engine.mode` lookup and the native path's `ARCANUM_REPO_PATH` env var), but every existing caller of `config.sh` today omits `repo_path` entirely and relies on ambient cwd already being the target repo. Grepped every `.md` caller of `auto-fix-all/scripts/config.sh` (not `monitor-issues/scripts/config.sh` — a different, out-of-scope script) to confirm this. The shim's new signature is:

  ```
  config.sh <get|is-enabled|set|toggle> <repo_path> <key> [<value>]
  ```

  Every caller already has `$REPO_PATH` resolved in its own scope (it's threaded there for other purposes already) — they just weren't passing it to `config.sh` because it never needed it before. `skill-writer` updates the 3 in-scope call sites (see `skill-writer.md`) to pass it now.

- **Why `config.sh` splits into 4 dedicated `*_shell.sh` files, not one renamed `config_shell.sh` — a real design constraint, not a style choice**: `engine_dispatch`'s `args` (everything after `--`) is forwarded *verbatim and identically* to both the shell branch (`bash "$shell_script" "${args[@]}"`) and the native branch (`core/bin/arcanum "$command" "${args[@]}"`) — there is no per-branch arg transformation available. A single shared `config_shell.sh` dispatching on a `<subcommand>` argument (today's `case ${1:-}` shape) would need `<subcommand>` in `args`; the native side doesn't need or want it there (the command name, e.g. `auto-fix-all-config-get`, already selects `AutoFixAllConfig#get`). Conversely `config_shell.sh` has no `repo_path` positional today, but `AutoFixAllConfig`'s methods must take `repoPath` as an explicit leading arg (`repo-path-threading.md` — no ambient-cwd/env-var fallback for actual business logic; `ARCANUM_REPO_PATH` is infrastructure-only, consumed today solely by `InvocationLog.js`, never by a command module). One shared `args` list literally cannot satisfy both a `<subcommand> <key>`-shaped shell script and a subcommand-less `<repoPath> <key>`-shaped native call at once.

  The resolution — the same one `github-issue-info`/`github-issue-create` already used (dedicated `github_issue_info_shell.sh`/`github_issue_create_shell.sh`, not one shared multi-case shell script) — is 4 separate per-subcommand shell scripts, each gaining `repo_path` as a new required leading argument exactly as `repo-path-threading.md` prescribes for "scripts that didn't take `repo_path` at all before": `config_get_shell.sh <repo_path> <key>`, `config_is_enabled_shell.sh <repo_path> <key>`, `config_set_shell.sh <repo_path> <key> <value>`, `config_toggle_shell.sh <repo_path> <key>`. Each sources `arcanum/_lib/repo_path.sh` and calls `repo_path_enter "$repo_path"` before touching any relative config path — after that `cd`, the original file-resolution logic (relative `.claude/...` paths) is unchanged. `args` is then uniformly `<repo_path> <key> [<value>]` for both branches — matching both the shell scripts above and `AutoFixAllConfig`'s `(repoPath, key[, value])` method signatures exactly. `config.sh` itself (today's file) is fully replaced by the shim; nothing is a straight rename this time.
