# Split list_plan_agents.sh into shell impl plus engine_dispatch shim

Rename the existing `list_plan_agents.sh` implementation to `list_plan_agents_shell.sh`, unchanged, and replace `list_plan_agents.sh` with a thin `engine_dispatch` shim that validates args and dispatches to shell/native per `engine.mode` and `migration-status.json` — mirroring the `create_branch.sh` split from #429 (`auto-fix-issue/scripts/create_branch.sh`).

The shim takes `<plan_dir>` as its only argument, validates it's non-empty (usage error otherwise), then calls `engine_dispatch "$REPO_PATH" auto-fix-issue-list-plan-agents "${SCRIPT_DIR}/list_plan_agents_shell.sh" -- "$@"`. No env vars need forwarding to the native path's allowlist — like `create_branch.sh`'s shim, this entrypoint touches no git identity/config, only a filesystem read.

Note `list_plan_agents.sh` (unlike `create_branch.sh`/`commit_change.sh`) does not take `<repo_path>` as its own first argument — its usage is `list_plan_agents.sh <plan_dir>` only, resolved by its callers (`auto-fix-issue/steps/run.md`, `dispatch_agents.md`, `auto-plan-issue/steps/write_plan.md`) as an absolute or already-repo-relative path. `engine_dispatch()` still needs a `repo_path` for its `config_chain_read` call — resolve it via the existing `arcanum/_lib/repo_path.sh` convention (same source the current shell impl already uses) rather than inventing a new argument.

## Files to Change
- `auto-fix-issue/scripts/list_plan_agents_shell.sh` — new file, exact copy of today's `list_plan_agents.sh` content (git mv + no edits).
- `auto-fix-issue/scripts/list_plan_agents.sh` — replaced with the `engine_dispatch` shim.
