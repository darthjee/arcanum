# Split list_agents.sh into a shell implementation and an engine_dispatch shim

`arcanum/_lib/list_agents.sh` currently holds the full implementation directly. Following the exact pattern `checkout_safe_branch.sh`/`checkout_safe_branch_shell.sh` established for #233:

1. Rename the current `arcanum/_lib/list_agents.sh` (full implementation, unchanged) to `arcanum/_lib/list_agents_shell.sh`.
2. Write a new `arcanum/_lib/list_agents.sh` as a thin `engine_dispatch` shim, mirroring `checkout_safe_branch.sh`'s shape:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   REPO_PATH="${1:-}"
   [[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> [agents_dir]" >&2; exit 1; }
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "${SCRIPT_DIR}/engine_dispatch.sh"
   engine_dispatch "$REPO_PATH" list-agents "${SCRIPT_DIR}/list_agents_shell.sh" -- "$@"
   ```
   No environment-variable allowlist entries are needed — this entrypoint is purely filesystem-based (no `gh`/network/auth dependency), same as `checkout-safe-branch`.
3. Every existing caller of `list_agents.sh` (`discuss-issue`, `plan-issue`, `auto-plan-issue` — grep for `list_agents.sh` across `.claude-favini/skills/` to find them all) keeps calling it by the same path/name; only its internal behavior (dispatch vs. direct execution) changes. No caller-side edits needed.

## Files to Change

- `arcanum/_lib/list_agents_shell.sh` — new file, exact content of today's `list_agents.sh`.
- `arcanum/_lib/list_agents.sh` — replaced with the thin `engine_dispatch` shim described above.
