# finish_report.sh shim

Create `arcanum/_lib/finish_report.sh`, a thin engine-dispatch shim in the same style as `arcanum/_lib/resolve_plan_paths.sh` and `list_agents.sh`. Source `engine_dispatch.sh` and call:

`engine_dispatch "$REPO_PATH" finish-report "${SCRIPT_DIR}/finish_report_shell.sh" -- "$@"`

Take `<repo_path>` from `$1`, with a usage error if it is missing. Forward no env vars, because the command does no GitHub I/O. The header comment points to `docs/agents/specs/skill-finish.md` and this plan.

## Files to Change
- `arcanum/_lib/finish_report.sh`: new
