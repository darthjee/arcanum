# Issue: Migrate auto-fix-issue-run-checks entrypoint to native Node.js

## Description
Sub-issue of #427 (batch overview). Part of the `auto-fix-issue` family, migrating `auto-fix-issue/scripts/run_checks.sh` to a native Node.js command per `docs/agents/architecture/script-engine.md`.

`run_checks.sh` runs the check script for a given agent, if one exists. Usage: `run_checks.sh <agent>`.

It looks for `.claude/scripts/check_<agent>.sh` relative to the current working directory (the target project's root). If found, it runs the script via `bash` (so stdout/stderr stream through normally) and exits with its exact exit code. If no check script exists for the agent, it prints a message saying so and exits 0 — "no checks configured" must never look like a failure to the caller.

### External dependencies
Spawns `.claude/scripts/check_<agent>.sh` as a child process (project-defined, arbitrary content) via `bash`, relying on cwd rather than an explicit `repo_path` argument. The native module's process-spawning approach must stream stdout/stderr live (not buffer-then-print) and must preserve the exact exit code, including nonzero ones.

### Dependencies on other sub-issues
None — no in-batch script calls this one or is called by it.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/run_checks.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueRunChecks.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-fix-issue-run-checks': { module: 'commands/auto-fix-issue/AutoFixIssueRunChecks.js', method: 'run' }`.
4. Add `"auto-fix-issue-run-checks": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/commands/auto-fix-issue/AutoFixIssueRunChecks_spec.js`, covering both the found/not-found script paths and exact exit-code propagation.
6. Write a parity test (shell vs. native, identical stdout/stderr streaming behavior and exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.
