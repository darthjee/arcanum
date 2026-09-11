# Issue: Migrate auto-fix-issue-list-plan-steps entrypoint to native Node.js

## Description
Sub-issue of #427 (batch overview). Part of the `auto-fix-issue` family of entrypoints being migrated from bash to native Node.js per `docs/agents/architecture/script-engine.md`.

This issue covers migrating `auto-fix-issue/scripts/list_plan_steps.sh`, which lists a specialist agent's ordered step files inside a plan directory. Usage: `list_plan_steps.sh <plan_dir> <agent_name>`.

Current behavior: lists all `*.md` files directly inside `<plan_dir>/<agent_name>` (no recursion, no filenames excluded) — each file is one ordered step for that agent's plan. Prints one file path per line, formatted as `<plan_dir>/<agent_name>/<file>`, ordered alphabetically by filename. Prints nothing and exits 0 if `<plan_dir>/<agent_name>` doesn't exist or is empty (meaning that agent's plan is inline, not split into steps).

## Problem
The bash entrypoint still runs as a shell script instead of the native Node.js implementation used by the rest of the migrated `auto-fix-issue` commands, leaving this one script inconsistent with the rest of the engine and outside native unit-test coverage.

## Expected Behavior
A native Node.js command (`auto-fix-issue-list-plan-steps`) reproduces the exact stdout and exit-code contract of the bash script, is registered in the command dispatch map, and is selectable via `engine.mode=native`/`engine.mode=shell` the same way sibling migrated commands are — with parity between both modes verified by a dedicated test.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/list_plan_steps.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanSteps.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-fix-issue-list-plan-steps': { module: 'commands/auto-fix-issue/AutoFixIssueListPlanSteps.js', method: 'run' }`.
4. Add `"auto-fix-issue-list-plan-steps": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/commands/auto-fix-issue/AutoFixIssueListPlanSteps_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

No external dependencies — this is a pure filesystem read, with no git or GitHub API calls involved. It has no dependency on other sub-issues of #427: no in-batch script calls it or is called by it, though it is the natural pair to `auto-fix-issue-list-plan-agents` (same plan-dir convention, already migrated — see `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents.js` for the established pattern to mirror).

## Benefits
Brings this entrypoint in line with the rest of the already-migrated `auto-fix-issue` family (#437, #438, #439), adds native unit-test coverage, and guarantees shell/native parity so `engine.mode` can be switched safely.
