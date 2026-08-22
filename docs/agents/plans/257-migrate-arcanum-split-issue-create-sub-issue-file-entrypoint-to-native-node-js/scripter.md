# scripter Plan: Migrate arcanum-split-issue-create-sub-issue-file entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

`create_sub_issue_file_shell.sh` (the file this agent creates by moving today's logic out of `create_sub_issue_file.sh`) is the byte-identical output/exit-code reference the `node` agent's native module must match — see `plan.md`'s "Shared contracts" for the full behavior spec (usage/error messages, gap-tolerant counting, snake_case transform, output file shape).

## Implementation Steps

### Step 1 — Split into a thin wrapper + shell implementation

Mirror the exact shape of `arcanum-split-issue/scripts/finish.sh` / `finish_shell.sh` (already migrated, issue #255):

- Move the entire current body of `arcanum-split-issue/scripts/create_sub_issue_file.sh` into a new `arcanum-split-issue/scripts/create_sub_issue_file_shell.sh`, unchanged in behavior.
- Replace `create_sub_issue_file.sh`'s content with a thin `engine_dispatch` shim, matching `finish.sh`'s structure: source `arcanum/_lib/engine_dispatch.sh` and call
  ```bash
  engine_dispatch "$REPO_PATH" arcanum-split-issue-create-sub-issue-file "${SCRIPT_DIR}/create_sub_issue_file_shell.sh" -- "$@"
  ```
  (no extra env vars need forwarding — this entrypoint has no external dependencies per the issue's "External dependencies" section, unlike `finish.sh`'s `HOME` forwarding for `gh`).
- Give the wrapper a header comment in the same style as `finish.sh`'s (references `docs/agents/architecture/script-engine.md` and this plan's `node.md`), and keep its `Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>` message.

### Step 2 — Point the standalone regression test at the shell implementation

`arcanum-split-issue/scripts/test_create_sub_issue_file.sh` currently calls `create_sub_issue_file.sh` directly. Update its `CREATE_SUB_ISSUE_FILE` variable to point at `create_sub_issue_file_shell.sh` instead, so it keeps exercising the shell logic directly regardless of `engine.mode`. No assertions need to change — the behavior being tested is unchanged, only the file that implements it moved.

## Files to Change

- `arcanum-split-issue/scripts/create_sub_issue_file.sh` — replace with a thin `engine_dispatch` wrapper.
- `arcanum-split-issue/scripts/create_sub_issue_file_shell.sh` — new file, today's logic moved here verbatim.
- `arcanum-split-issue/scripts/test_create_sub_issue_file.sh` — retarget at `create_sub_issue_file_shell.sh`.

## Notes

- This entrypoint has no shared `arcanum/_lib/*.sh` dependency beyond `repo_path.sh` and no GitHub API calls (per the issue's "External dependencies" section), so the wrapper needs no extra env-var allowlist entries beyond what `engine_dispatch` already provides.
