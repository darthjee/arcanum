# Issue: Migrate arcanum-update-run-update entrypoint (check, apply) to native Node.js

## Description

Sub-issue of #252 (batch overview). `arcanum-update` family.

### Source script

`arcanum-update/scripts/run_update.sh`

Resolves and drives an arcanum self-update, with 2 subcommands: `check` (prints `METHOD=`/`REPO=`/`CURRENT=`/`TARGET=`, resolving zip vs. git install method) and `apply` (runs `arcanum/update/bootstrap.sh` with `ARCANUM_ASSUME_YES=1`, streaming its output live, then prints `RESULT=updated FROM=... TO=...` or `RESULT=noop VERSION=...`). Both subcommands share the same resolution step: if `arcanum/update/bootstrap.sh` is missing, or neither `arcanum.json` nor `.git` is present at the resolved target, they print `STATUS=missing_arcanum` and exit 1.

### External dependencies

- `apply` shells out to `arcanum/update/bootstrap.sh` directly (**out-of-batch**, not part of this migration) and must stream its stdout/stderr live, propagating its exit code unchanged on failure — use `spawn` with `stdio: 'inherit'` (or equivalent), never a string-interpolated `exec()`.
- `git` (`remote get-url origin` for repo parsing, `describe --tags --exact-match` / `rev-parse --short HEAD` for the current version) and `jq`-equivalent JSON parsing (built-in `JSON.parse`, no `jq` dependency needed) for the zip-install `arcanum.json` case (`.repo`/`.version` fields).
- Confirmed in scope: per `docs/agents/architecture/script-engine.md`'s "Scope boundaries" section, only `<skill>/scripts/*.sh` and `arcanum/_lib/*.sh` are in scope for this migration, and `arcanum-update/scripts/run_update.sh` is exactly that — a skill entrypoint script. It belongs to this migration batch, not to the install/update pipeline's own separate scope. `arcanum/update/bootstrap.sh` itself (the thing `apply` shells out to) stays out-of-batch, as noted above.

### Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.

## Solution

Follow `docs/agents/architecture/script-engine.md` — this script has multiple subcommands, so it migrates to **one module with multiple methods**, one `COMMANDS` entry per subcommand (same precedent as `github-issue-create`/`github-issue-info` both mapping to `GithubIssue.js`):

1. Read `arcanum-update/scripts/run_update.sh` for its exact output/exit-code contract (both subcommands, including the shared `STATUS=missing_arcanum` exit-1 case).
2. Create `core/lib/ArcanumUpdateRunUpdate.js` (zero runtime deps, built-in Node APIs only) with methods `check`, `apply`.
3. Register in `core/bin/arcanum`'s `COMMANDS` map:
   - `'arcanum-update-run-update-check': { module: 'ArcanumUpdateRunUpdate.js', method: 'check' }`
   - `'arcanum-update-run-update-apply': { module: 'ArcanumUpdateRunUpdate.js', method: 'apply' }`
4. Add `"arcanum-update-run-update": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/ArcanumUpdateRunUpdate_spec.js`, covering both subcommands, including the `STATUS=missing_arcanum` case.
6. Write parity tests (shell vs. native, identical stdout/exit code) for `check` and `apply`.
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.
