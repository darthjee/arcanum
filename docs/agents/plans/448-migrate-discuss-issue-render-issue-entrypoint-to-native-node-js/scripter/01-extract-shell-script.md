# Extract the shell implementation

Copy the current `discuss-issue/scripts/render_issue.sh` verbatim to `discuss-issue/scripts/render_issue_shell.sh` — this becomes the shell-mode implementation that the new shim dispatches to. No behavior change; this is a pure extraction so the existing logic keeps running unmodified under `engine.mode=shell` (and is what `node`'s parity test runs directly).

## Files to Change

- `discuss-issue/scripts/render_issue_shell.sh` — new file, the extracted, unmodified shell implementation.
