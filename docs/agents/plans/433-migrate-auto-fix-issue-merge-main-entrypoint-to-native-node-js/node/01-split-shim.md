# Split the shim from the shell implementation

Follow the exact split already done for the sibling `auto-fix-issue-create-branch` migration (`auto-fix-issue/scripts/create_branch.sh`, issue #429):

1. Rename `auto-fix-issue/scripts/merge_main.sh` to `auto-fix-issue/scripts/merge_main_shell.sh`, content unchanged — this keeps the existing bash implementation (`git fetch`, `git_branch_merge_main`, `STATUS=ok`/`STATUS=conflict` printing, exit 0/2) intact as the fallback path.
2. Replace `auto-fix-issue/scripts/merge_main.sh` with a thin `engine_dispatch` shim, mirroring `create_branch.sh`'s shape:
   - Usage guard: `<repo_path>` required (usage message + exit 1 if missing) — `merge_main.sh` only ever takes one positional argument, unlike `create_branch.sh`'s three.
   - Source `arcanum/_lib/engine_dispatch.sh`.
   - Dispatch: `engine_dispatch "$REPO_PATH" auto-fix-issue-merge-main "${SCRIPT_DIR}/merge_main_shell.sh" -- "$@"`.
   - Header comment: same shape as `create_branch.sh`'s — link this plan's `node.md`, describe what the entrypoint does, and note which env vars (if any) get forwarded to the native path's allowlist (none needed here — `merge_main` only reads/writes the repo's `.git`, it never touches commit identity or GitHub credentials).

## Files to Change

- `auto-fix-issue/scripts/merge_main_shell.sh` — new file, exact content of today's `merge_main.sh` (unchanged).
- `auto-fix-issue/scripts/merge_main.sh` — rewritten as the thin `engine_dispatch` shim described above.
