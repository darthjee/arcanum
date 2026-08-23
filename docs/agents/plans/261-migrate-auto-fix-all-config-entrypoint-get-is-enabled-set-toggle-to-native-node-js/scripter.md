# scripter Plan: Migrate auto-fix-all-config entrypoint (get, is-enabled, set, toggle) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See `plan.md`'s "Shared contracts" for the full detail, especially "New CLI signature" and "Why `config.sh` splits into 4 dedicated `*_shell.sh` files". This agent must:
- Dispatch each of the 4 subcommands through `engine_dispatch` using the exact command names `auto-fix-all-config-get`, `auto-fix-all-config-is-enabled`, `auto-fix-all-config-set`, `auto-fix-all-config-toggle` — these must match `node`'s `core/bin/arcanum` `COMMANDS` keys and `migration-status.json`'s keys byte-for-byte.
- Add `migration-status.json` entries as **four separate keys** (not the single `"auto-fix-all-config"` key the issue body literally says) — see `plan.md`'s correction note.
- No `engine_dispatch` env-var allowlist entries are needed for any of the four subcommands (pure filesystem I/O, repo-path-scoped only).
- `args` forwarded to `engine_dispatch` must be exactly `<repo_path> <key>` (or `<repo_path> <key> <value>` for `set`) — this is what makes the same `args` list work for both the shell script (`config_<subcommand>_shell.sh <repo_path> <key> [<value>]`) and the native call (`AutoFixAllConfig#<method>(repoPath, key[, value])`, per `node`'s Step 01/02).
- New shim signature is `config.sh <get|is-enabled|set|toggle> <repo_path> <key> [<value>]` — `skill-writer` updates the 3 existing call sites to match; this agent does **not** touch those call sites (they live outside `auto-fix-all/scripts/` and `arcanum/_lib/`, out of this agent's scope).

## Implementation Steps

### Step 1 — Split config.sh into a shim + 4 dedicated `*_shell.sh` files

Unlike `checkout_from_main.sh` (a straight rename to `checkout_from_main_shell.sh`), `config.sh`'s 4 subcommands each become their own shell script — see `plan.md`'s "Why `config.sh` splits into 4 dedicated `*_shell.sh` files" for why a single shared `config_shell.sh` can't work here (`engine_dispatch` forwards one `args` list identically to both the shell and native branch, and a shared multi-case shell script needs a `<subcommand>` arg the native side doesn't want).

1. Factor `auto-fix-all/scripts/config.sh`'s current `_new_file_for_key`/`_legacy_file_for_key` helpers (and the `CONFIG_FILE`/`NEW_CONFIG_FILE`/`NEW_STATE_FILE`/`NAMESPACE` constants they use) out into a small sourced-only file, `auto-fix-all/scripts/config_common.sh`, so the 4 new scripts below don't each duplicate them. This file also sources `arcanum/_lib/repo_config.sh` (for `repo_config_read`/`repo_config_write`) — same as today's `config.sh` does.

2. Create 4 new scripts, each: sources `config_common.sh` and `arcanum/_lib/repo_path.sh`; calls `repo_path_enter "$1"` first (validates + `cd`'s into `repo_path`, per `repo-path-threading.md` — this is what lets the rest of each script keep using the exact same relative `.claude/...` paths `config.sh` always used); then reuses today's per-subcommand body from `config.sh` verbatim (same validation, same `repo_config_read`/`repo_config_write` calls, same stdout/exit codes):
   - `auto-fix-all/scripts/config_get_shell.sh <repo_path> <key>` — today's `get)` branch.
   - `auto-fix-all/scripts/config_is_enabled_shell.sh <repo_path> <key>` — today's `is-enabled)` branch.
   - `auto-fix-all/scripts/config_set_shell.sh <repo_path> <key> <value>` — today's `set)` branch.
   - `auto-fix-all/scripts/config_toggle_shell.sh <repo_path> <key>` — today's `toggle)` branch.

   Each script's own usage-error messages (e.g. `"Error: get requires a key"`) stay worded exactly as today's `config.sh` — only the new leading `repo_path` argument and its own validation (via `repo_path_enter`) are added on top.

3. Delete `auto-fix-all/scripts/config.sh`'s old body and replace it with a thin per-subcommand `engine_dispatch` shim, modeled on `arcanum/_lib/github_issue.sh`'s shape (that file also dispatches through per-subcommand dedicated shell scripts, not one shared multi-case one — this shim differs only in that **all 4** subcommands here are in scope, so there's no unmigrated-subcommand shell fallback case):

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2; exit 1; }
shift

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 $COMMAND <repo_path> [...]" >&2; exit 1; }
shift

# From here, "$@" is just <key> or <key> <value> — engine_dispatch's args
# below re-prepends "$REPO_PATH" so both the shell script and the native
# call receive an identical, correctly-shaped <repo_path> <key> [<value>].
case "$COMMAND" in
  get)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-get "${SCRIPT_DIR}/config_get_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  is-enabled)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-is-enabled "${SCRIPT_DIR}/config_is_enabled_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  set)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-set "${SCRIPT_DIR}/config_set_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  toggle)
    engine_dispatch "$REPO_PATH" auto-fix-all-config-toggle "${SCRIPT_DIR}/config_toggle_shell.sh" -- "$REPO_PATH" "$@"
    ;;
  *)
    echo "Usage: $0 {get <key>|is-enabled <key>|set <key> true|false|toggle <key>}" >&2
    exit 1
    ;;
esac
```

### Step 2 — Flip migration-status.json

Add the four keys from "Shared contracts" above to `arcanum/_lib/migration-status.json`, each set to `true`, replacing the single existing `"auto-fix-all-config": false` entry.

## Files to Change

- `auto-fix-all/scripts/config.sh` — replaced entirely with the `engine_dispatch` shim above (not a rename — the old body moves into the 4 files below).
- `auto-fix-all/scripts/config_common.sh` — new file, the shared `_new_file_for_key`/`_legacy_file_for_key`/constants sourced by the 4 scripts below.
- `auto-fix-all/scripts/config_get_shell.sh` — new file.
- `auto-fix-all/scripts/config_is_enabled_shell.sh` — new file.
- `auto-fix-all/scripts/config_set_shell.sh` — new file.
- `auto-fix-all/scripts/config_toggle_shell.sh` — new file.
- `arcanum/_lib/migration-status.json` — replace the single `"auto-fix-all-config": false` key with the four per-subcommand keys, each `true`.

## Notes

- No CI job covers shellcheck/bats for this repo (checked `.circleci/config.yml` — only `core-test`/`core-lint`/`build-and-release` jobs exist), so no `## CI Checks` entry applies to this agent's files. `node`'s parity spec (`core/spec/bin/autoFixAllConfigParity_spec.js`) is what actually exercises the 4 `*_shell.sh` scripts and `config.sh`'s shim under `core-test`.
- `skill-writer`'s call-site updates (see `skill-writer.md`) depend on this agent's new `config.sh <subcommand> <repo_path> <key> [<value>]` signature landing in the same PR — both should be reviewed together.
