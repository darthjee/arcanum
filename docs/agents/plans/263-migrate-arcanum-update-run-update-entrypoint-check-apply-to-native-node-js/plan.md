# Plan: Migrate arcanum-update-run-update entrypoint (check, apply) to native Node.js

Issue: [263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js.md](../issues/263-migrate-arcanum-update-run-update-entrypoint-check-apply-to-native-node-js.md)

## Overview

Migrate `arcanum-update/scripts/run_update.sh` (subcommands `check`, `apply`) to native Node.js, following `docs/agents/architecture/script-engine.md`. `scripter` turns the existing script into a thin `engine_dispatch` shim plus two shell-fallback scripts, one per subcommand, and flips the migration-status flag. `node` writes the native module (`check`/`apply`), registers both commands in `core/bin/arcanum`, and writes the unit + parity specs. Unlike the `auto-fix-all-config` precedent, this entrypoint's public calling convention (`scripts/run_update.sh check|apply`, no `repo_path` argument) does not change — `arcanum-update/SKILL.md` needs no edits.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Command names** (`core/bin/arcanum` COMMANDS keys, also the `migration-status.json` key and the first arg `scripter`'s shim passes to `engine_dispatch`): `arcanum-update-run-update-check`, `arcanum-update-run-update-apply`.
- **The self-resolved target path.** `run_update.sh` has never taken `repo_path` as an argument — today it derives `TARGET_PATH` from its own on-disk location (`cd "${SCRIPT_DIR}/../.." && pwd`, i.e. two levels up from `arcanum-update/scripts/`), which is "the arcanum install this skill lives inside," not necessarily the `REPO_PATH` of whatever other skill is running. Keep that self-resolution in the shim (`scripter`'s work) — do **not** add a new CLI argument or touch `arcanum-update/SKILL.md`. The shim computes this path once and passes it as both `engine_dispatch`'s own leading `<repo_path>` (needed only to resolve `engine.mode`) and as the sole positional argument after `--`, so the native module receives exactly the same value the shell fallback does. `node`'s `check`/`apply` methods take this single argument — call it `repoPath` for naming consistency with the rest of `core/lib/`, even though semantically it is the arcanum install's own location.
- **Shell-fallback script paths**, created by `scripter`, that `node`'s parity spec shells out to for comparison: `arcanum-update/scripts/run_update_check_shell.sh <target_path>` and `arcanum-update/scripts/run_update_apply_shell.sh <target_path>`.
- **Byte-identical stdout/exit-code contract**, unchanged from today's `run_update.sh` (see `arcanum-update/scripts/run_update.sh`'s own header comment for the authoritative spec), for both the shell-fallback scripts and the native module:
  - Missing arcanum (`arcanum/update/bootstrap.sh` absent, or neither `arcanum.json` nor `.git` present at the target): stdout `STATUS=missing_arcanum\n`, exit 1. Same for both subcommands.
  - `check` success: `METHOD=<zip|git>\nREPO=<repo>\nCURRENT=<version-or-ref>\nTARGET=<path>\n`, exit 0.
  - `apply` success: `arcanum/update/bootstrap.sh`'s own stdout/stderr streamed live throughout, then exactly one final line — `RESULT=updated FROM=<old> TO=<new>\n` or `RESULT=noop VERSION=<current>\n` — exit 0.
  - `apply` bootstrap failure: bootstrap's own output already streamed live; nothing further printed; exit with bootstrap's own nonzero exit code, unchanged.
- **`DispatchFailure` usage** (`node`'s module throws these instead of returning a string — see `core/lib/DispatchFailure.js`): missing-arcanum path → `new DispatchFailure('STATUS=missing_arcanum\n', 1)`; `apply`'s bootstrap-failure path → `new DispatchFailure('', rc)` (empty stdout payload, `rc` = bootstrap's own exit code) — this is what lets `dispatch()` propagate an arbitrary exit code with zero extra stdout/stderr.
- **Environment forwarding for `apply`'s child `bootstrap.sh` process.** Today's shell script inherits the full calling environment plus `ARCANUM_ASSUME_YES=1`. Under `engine.mode=native`, `core/bin/arcanum` itself only receives `PATH`, `ARCANUM_REPO_PATH`, and whatever `engine_dispatch`'s explicit allowlist forwards (see `docs/agents/architecture/script-engine.md`'s "Env-var passing" section) — `process.env` inside the native module is *not* the full ambient environment. `scripter`'s `engine_dispatch` call for `arcanum-update-run-update-apply` must include `HOME` in its env-var allowlist (needed for git's global config/credential helpers during a git-clone-method update) — see `node/01-native-module.md`'s Notes for the open question on whether SSH-agent auth (`SSH_AUTH_SOCK`) also needs forwarding.
