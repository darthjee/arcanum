# Shim the shell entrypoint through engine_dispatch

Rename the current `auto-fix-all/scripts/wait_ci.sh` to `auto-fix-all/scripts/wait_ci_shell.sh` (full original logic, unchanged), and replace `wait_ci.sh` with a thin shim that sources `arcanum/_lib/engine_dispatch.sh` and delegates to it — same shape as the five already-merged sibling migrations (e.g. `auto-fix-all/scripts/reply_comment.sh`). Forward `HOME` in the native path's explicit env-var allowlist, since the native implementation resolves credentials via `gh auth token` internally (through `GithubToken.js`) once `engine_dispatch`'s `env -i PATH="$PATH"` strips the ambient environment for the native call.

Any caller of `auto-fix-all/scripts/wait_ci.sh` elsewhere in the repo (e.g. `wait_ci_and_merge.sh`, if it shells out to this script directly rather than sourcing it) keeps working unchanged, since the shim preserves the original filename and CLI contract.

## Files to Change

- `auto-fix-all/scripts/wait_ci_shell.sh` — new file; the original `wait_ci.sh` content, unchanged.
- `auto-fix-all/scripts/wait_ci.sh` — replaced with the thin `engine_dispatch` shim.
