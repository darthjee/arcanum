# Add native AutoFixIssueListPlanSteps command

Create `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanSteps.js`, the native equivalent of `list_plan_steps_shell.sh`, modeled directly on `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents.js`'s shape (constructor-injected `readdir` for testability, zero runtime deps, built-in Node APIs only):

- `run(planDir, agentName)`: throws `Error('Usage: list_plan_steps.sh <plan_dir> <agent_name>')` (propagated uncaught so the caller exits 1) when either argument is missing/empty.
- Reads `<planDir>/<agentName>` via `readdir`; on any error (directory doesn't exist) or an empty result, returns `''` — matching the shell script's `[[ -d ... ]] || exit 0` and empty-glob short-circuit.
- Filters to entries ending in `.md`, formats each as `<planDir>/<agentName>/<entry>` (path.join), sorts alphabetically by filename (not full path — matches the shell script's `sort` on `"$PLAN_DIR/$AGENT_NAME"/*.md`, which sorts by the full glob-expanded path, but since the directory prefix is identical for every entry this is equivalent to sorting by filename).
- Do **not** strip to bare filenames — unlike `AutoFixIssueListPlanAgents`, this command's output is the full `<plan_dir>/<agent_name>/<file>` path per line, one per line, joined with `\n` and a trailing newline (or `''` when there are no matches).

## Files to Change
- `core/lib/commands/auto-fix-issue/AutoFixIssueListPlanSteps.js` — new file.
