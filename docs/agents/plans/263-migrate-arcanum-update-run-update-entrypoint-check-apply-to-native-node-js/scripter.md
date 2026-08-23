# scripter Plan: Migrate arcanum-update-run-update entrypoint (check, apply) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command names: `arcanum-update-run-update-check`, `arcanum-update-run-update-apply`.
- The shim self-resolves the arcanum install's own location (`TARGET_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"`, same computation `run_update.sh` already does today) — no new CLI argument, no `arcanum-update/SKILL.md` change. Pass that path as both `engine_dispatch`'s own leading `<repo_path>` and as the sole positional arg after `--`.
- Shell-fallback filenames `node`'s parity spec depends on: `arcanum-update/scripts/run_update_check_shell.sh <target_path>`, `arcanum-update/scripts/run_update_apply_shell.sh <target_path>`.
- For `apply`'s `engine_dispatch` call, include `HOME` in the env-var allowlist (positional names before the `--`) — needed so `arcanum/update/bootstrap.sh`'s git operations (global config, credential helpers) still work when `engine.mode=native` runs it through `core/bin/arcanum`'s trimmed environment. See `node/01-native-module.md`'s Notes for the open `SSH_AUTH_SOCK` question — coordinate with `node` if that also needs adding here.

## Implementation Steps

### Step 1 — Split `run_update.sh` into a thin `engine_dispatch` shim plus two shell-fallback scripts

Follow the exact shape of `auto-fix-all/scripts/config.sh`'s own split (see git history for issue #261, commit message "Migrate auto-fix-all-config entrypoint... to native Node.js") and `arcanum-split-issue/scripts/create_sub_issue_file.sh` / `auto-fix-all/scripts/checkout_from_main.sh`'s single-subcommand equivalents (issues #257, #258) as precedent for the two-subcommand case.

- Rewrite `arcanum-update/scripts/run_update.sh` into a thin shim: `source`s `arcanum/_lib/engine_dispatch.sh`, self-resolves `TARGET_PATH` (the same two-levels-up computation the current script does), parses `${1:-}` (`check`|`apply`) same as today, and for each dispatches:
  - `engine_dispatch "$TARGET_PATH" arcanum-update-run-update-check "${SCRIPT_DIR}/run_update_check_shell.sh" -- "$TARGET_PATH"` — no env-var allowlist entries: `check` has no `bootstrap.sh` child process and no env dependency beyond `PATH`/`git`/`jq`-equivalent, which are already forwarded by default. Only `apply` needs `HOME` (below), per the Shared Contracts note above.
  - `engine_dispatch "$TARGET_PATH" arcanum-update-run-update-apply "${SCRIPT_DIR}/run_update_apply_shell.sh" HOME -- "$TARGET_PATH"`
  - Unknown/missing subcommand: keep today's `Usage: $0 check|apply` stderr message and exit 1, unchanged.
- Create `arcanum-update/scripts/run_update_check_shell.sh <target_path>`: today's `cmd_check` body (`resolve_target`, `current_version`, the `METHOD=`/`REPO=`/`CURRENT=`/`TARGET=` output, the `STATUS=missing_arcanum` exit-1 path), adapted to take `target_path` as an explicit argument instead of re-deriving it from `$SCRIPT_DIR/../..` (the caller — the shim — already did that).
- Create `arcanum-update/scripts/run_update_apply_shell.sh <target_path>`: today's `cmd_apply` body (`resolve_target`/`STATUS=missing_arcanum`, `current_version` before, `export ARCANUM_ASSUME_YES=1`, run `arcanum/update/bootstrap.sh` streamed live, propagate its exit code unchanged on failure, `current_version` after, `RESULT=updated ...` / `RESULT=noop ...`), same `target_path`-as-argument adaptation.
- Extract whatever the two shell-fallback scripts end up sharing (`parse_github_owner_repo`, `resolve_target`, `current_version`) into a small sourced `run_update_common.sh` (mirrors `config_common.sh`'s precedent) rather than duplicating it in both files.
- Keep `arcanum-update/SKILL.md` as-is — it already calls `scripts/run_update.sh check` / `scripts/run_update.sh apply` with no `repo_path`, and that calling convention does not change.

## Files to Change

- `arcanum-update/scripts/run_update.sh` — rewritten into the thin `engine_dispatch` shim.
- `arcanum-update/scripts/run_update_check_shell.sh` — new, `check`'s shell implementation.
- `arcanum-update/scripts/run_update_apply_shell.sh` — new, `apply`'s shell implementation.
- `arcanum-update/scripts/run_update_common.sh` — new, shared helpers (`parse_github_owner_repo`, `resolve_target`, `current_version`) sourced by both `_shell.sh` scripts.

### Step 2 — Flip the migration-status flag

Set `"arcanum-update-run-update": true` in `arcanum/_lib/migration-status.json`, once `node`'s module and command registration (see [node.md](node.md)) both exist and pass their specs — this is what `engine_dispatch.sh`'s `_engine_dispatch_native_available` check consults to allow `engine.mode=native` to actually route to the native implementation instead of silently falling back to shell.

## Files to Change

- `arcanum/_lib/migration-status.json` — `"arcanum-update-run-update"` flipped from `false` to `true`.

## Notes

- No `arcanum-update/SKILL.md` change and no other caller updates — unlike `auto-fix-all-config`, this entrypoint's public signature is unchanged.
- Confirm during implementation whether `check`'s `engine_dispatch` call needs any env-var allowlist entries at all beyond the default (`PATH`, `ARCANUM_REPO_PATH`) — `jq`-equivalent parsing and `git remote`/`describe`/`rev-parse` shouldn't need `HOME`, but verify against a real zip-install (`arcanum.json` present) and a real git-clone install locally before assuming.
