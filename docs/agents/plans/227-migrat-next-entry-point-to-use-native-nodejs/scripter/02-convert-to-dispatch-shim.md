# Convert to an engine_dispatch shim

Rewrite `arcanum/_lib/resolve_id_and_file.sh` itself into a thin shim that sources `engine_dispatch.sh` and calls `engine_dispatch`, following the exact pattern `arcanum/_lib/resolve_and_fetch.sh` already uses:

```bash
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" resolve-id-and-file "${SCRIPT_DIR}/resolve_id_and_file_shell.sh" -- "$@"
```

The command key is `resolve-id-and-file` (see [plan.md](../plan.md)'s Shared contracts). No extra env-var allowlist entries beyond what `engine_dispatch` always includes (`PATH`) — unlike `resolve-and-fetch`, this entry point never calls `gh`/needs `$HOME`.

Filename and call sites (`discuss-issue/scripts/resolve_id_and_file.sh`, `auto-new-issue/scripts/resolve_id_and_file.sh`, both thin `exec`-forwarding wrappers) stay unchanged — they keep calling `arcanum/_lib/resolve_id_and_file.sh` exactly as before; Step 03 verifies this.

## Files to Change

- `arcanum/_lib/resolve_id_and_file.sh` — reduced to the `engine_dispatch` shim shown above.
