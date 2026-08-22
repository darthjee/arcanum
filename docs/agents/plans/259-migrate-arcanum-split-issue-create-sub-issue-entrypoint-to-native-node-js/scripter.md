# scripter Plan: Migrate arcanum-split-issue-create-sub-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Shim must call `engine_dispatch` with the exact command name `arcanum-split-issue-create-sub-issue`, matching the `core/bin/arcanum` `COMMANDS` key and the `arcanum/_lib/migration-status.json` key node's work uses — see plan.md.
- Shim must forward `HOME` in the env-var allowlist (native calls `gh` in-process via `SpawnIssue`) — same as `arcanum/_lib/spawn_issue.sh`'s own shim.
- The renamed `create_sub_issue_shell.sh` must keep calling `arcanum/_lib/spawn_issue.sh` and `arcanum/_lib/issue_state.sh` (the dispatch shims) exactly as today — no logic changes, only the rename and a header-comment update.

## Implementation Steps

### Step 1 — Rename the current script to `create_sub_issue_shell.sh`

`git mv arcanum-split-issue/scripts/create_sub_issue.sh arcanum-split-issue/scripts/create_sub_issue_shell.sh`. Update its header comment to describe it as the shell implementation invoked by the new `create_sub_issue.sh` shim (mirror `create_sub_issue_file_shell.sh`'s header for phrasing), but make no other logic changes — same usage line, same `STATUS=ok`/`STATUS=failed` output contract, same delegation to `arcanum/_lib/spawn_issue.sh` and `arcanum/_lib/issue_state.sh`.

### Step 2 — Write the `create_sub_issue.sh` engine_dispatch shim

Replace `arcanum-split-issue/scripts/create_sub_issue.sh` with a thin shim, mirroring `arcanum-split-issue/scripts/create_sub_issue_file.sh`'s shape:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-split-issue-create-sub-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Creates one sub-issue on GitHub from
# a local sub-issue draft file, via either the shell implementation
# (create_sub_issue_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# HOME is forwarded to the native path's explicit env-var allowlist — the
# native implementation calls `gh` in-process (via SpawnIssue) and needs it
# to resolve credentials once native's `env -i PATH="$PATH"` strips the
# ambient environment; mirrors arcanum/_lib/spawn_issue.sh's own shim.
#
# Usage: create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>
#
# Output and exit code: unchanged from before this migration — see
# create_sub_issue_shell.sh's own header for the full STATUS=ok/ID=.../
# STATUS=failed contract.

set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"
SUB_ISSUE_FILE="${3:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" && -n "$SUB_ISSUE_FILE" ]] || {
  echo "Usage: $0 <repo_path> <issue_id> <sub_issue_file>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-split-issue-create-sub-issue "${SCRIPT_DIR}/create_sub_issue_shell.sh" HOME -- "$@"
```

## Files to Change

- `arcanum-split-issue/scripts/create_sub_issue_shell.sh` — new (renamed from `create_sub_issue.sh`, header updated only).
- `arcanum-split-issue/scripts/create_sub_issue.sh` — rewritten as the `engine_dispatch` shim.

## Notes

- No standalone shell regression test exists for `create_sub_issue.sh` (unlike `create_sub_issue_file.sh`'s `test_create_sub_issue_file.sh`), so there's nothing else under `arcanum-split-issue/scripts/` to update.
