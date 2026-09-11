# Issue: Migrate auto-fix-issue-list-plan-agents entrypoint to native Node.js

## Description
Sub-issue of #427 (batch overview) — part of the `auto-fix-issue` family of scripts being migrated to native Node.js.

Migrates `auto-fix-issue/scripts/list_plan_agents.sh` to a native Node.js command, per the architecture in `docs/agents/architecture/script-engine.md`.

## Problem
`auto-fix-issue/scripts/list_plan_agents.sh` (usage: `list_plan_agents.sh <plan_dir>`) still runs as a bash script rather than through the native command engine.

It lists specialist agents that have their own plan file in a plan dir:
- Lists all `*.md` files directly inside `<plan_dir>` except `plan.md` itself — each matching file (e.g. `backend.md`) corresponds to a specialist agent (`backend`).
- Prints one agent name per line, ordered alphabetically by filename.
- Prints nothing and exits 0 if `<plan_dir>` doesn't exist or has no agent files (only `plan.md`, or empty).

External dependencies to re-derive natively:
- None — pure filesystem read (`fs.readdir`/glob equivalent), no git or GitHub API calls.

No in-batch script calls this one or is called by it — no dependencies on other sub-issues in the #427 batch.

## Solution
Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/list_plan_agents.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-fix-issue-list-plan-agents': { module: 'commands/auto-fix-issue/AutoFixIssueListPlanAgents.js', method: 'run' }`.
4. Set `"auto-fix-issue-list-plan-agents": true` in `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents_spec.js`.
6. Write a parity test in `core/spec/bin/autoFixIssueListPlanAgentsParity_spec.js` (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for both `engine.mode=native` and `engine.mode=shell`.

## Benefits
- Moves `auto-fix-issue-list-plan-agents` off bash and onto the native engine, matching sibling migrations already completed in the #427 batch (e.g. `auto-fix-issue-create-branch`).
- Native unit + parity tests give tighter coverage than the current shell script.
- One less bash entrypoint to maintain once the `auto-fix-issue` family is fully migrated.
