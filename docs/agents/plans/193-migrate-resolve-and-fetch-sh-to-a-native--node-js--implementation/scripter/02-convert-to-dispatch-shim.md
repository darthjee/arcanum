# Convert to an engine_dispatch shim

Move the simplified logic from Step 01 out of `resolve_and_fetch.sh` into its own implementation file (e.g. `arcanum/_lib/resolve_and_fetch_shell.sh`), then rewrite `resolve_and_fetch.sh` itself into a thin shim that sources `engine_dispatch.sh` and calls `engine_dispatch`, following the exact pattern `arcanum/_lib/test_engine_dispatch.sh` already exercises against its `dispatch-fixture` fixture:

```bash
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-and-fetch "${SCRIPT_DIR}/resolve_and_fetch_shell.sh" HOME -- "$@"
```

The command key is `resolve-and-fetch` (see [plan.md](../plan.md)'s Shared contracts). Include `HOME` in the env allowlist — `gh auth token` (called deeper in the shell implementation via `github_issue.sh`) needs it to find its own config once the native path's `env -i PATH="$PATH"` strips the ambient environment down; without it, native-mode auth would fail in a way shell-mode never does.

Filename and call sites (`discuss-issue`, `enhance-issue`, `arcanum-split-issue`) stay unchanged — they all call `resolve_and_fetch.sh` (or a thin per-skill wrapper around it) exactly as before.

## Files to Change

- `arcanum/_lib/resolve_and_fetch.sh` — reduced to the `engine_dispatch` shim shown above.
- `arcanum/_lib/resolve_and_fetch_shell.sh` (new) — receives the logic (repo_path/issues_folder args, the Step 01 id parser, safe-branch checkout call, `github_issue.sh fetch` call) that used to live directly in `resolve_and_fetch.sh`.
