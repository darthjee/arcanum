# Split the shell script

Split `auto-fix-issue/scripts/create_branch.sh` into a preserved shell implementation plus a thin `engine_dispatch` shim, the same shape used for `commit_change.sh`/`commit_change_shell.sh` in #428.

- Rename today's `create_branch.sh` implementation to `create_branch_shell.sh` verbatim (same usage/behavior/output contract, only the filename changes and any internal self-references to the old name are updated).
- Replace `create_branch.sh` with a thin shim: validates the same required args, then sources `arcanum/_lib/engine_dispatch.sh` and calls `engine_dispatch "$REPO_PATH" auto-fix-issue-create-branch "${SCRIPT_DIR}/create_branch_shell.sh" -- "$@"` (add any env-var allowlist entries this step's investigation finds necessary — see node.md's Notes).

## Files to Change
- `auto-fix-issue/scripts/create_branch_shell.sh` — new file: today's `create_branch.sh` implementation, unchanged behavior.
- `auto-fix-issue/scripts/create_branch.sh` — replaced with the `engine_dispatch` shim.
