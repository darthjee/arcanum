# Split list_plan_steps.sh into shell impl + engine_dispatch shim

Rename the existing `auto-fix-issue/scripts/list_plan_steps.sh` to `list_plan_steps_shell.sh` with its content unchanged, then replace `list_plan_steps.sh` with a thin `engine_dispatch` shim, mirroring `auto-fix-issue/scripts/list_plan_agents.sh` exactly:

- Validates `<plan_dir>` and `<agent_name>` are both present (same usage-error text/exit code as today).
- Sources `arcanum/_lib/engine_dispatch.sh`.
- Derives `REPO_PATH` from the ambient git checkout (`git rev-parse --show-toplevel 2>/dev/null || pwd`) — `list_plan_steps.sh` takes no `repo_path` argument of its own, same as `list_plan_agents.sh`.
- Calls `engine_dispatch "$REPO_PATH" auto-fix-issue-list-plan-steps "${SCRIPT_DIR}/list_plan_steps_shell.sh" -- "$@"` — no env vars forwarded (pure filesystem read).

## Files to Change
- `auto-fix-issue/scripts/list_plan_steps_shell.sh` — new file, exact copy of today's `list_plan_steps.sh` content.
- `auto-fix-issue/scripts/list_plan_steps.sh` — replaced with the `engine_dispatch` shim described above.
