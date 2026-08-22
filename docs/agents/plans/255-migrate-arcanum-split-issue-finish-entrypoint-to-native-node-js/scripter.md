# scripter Plan: Migrate arcanum-split-issue-finish entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The command name is `arcanum-split-issue-finish`; the shim must call `engine_dispatch` with that exact name so it matches the `migration-status.json` key `node` will add native support for.
- CLI usage stays `finish.sh <repo_path> <issue_id>` — unchanged from the caller's perspective (`arcanum-split-issue/steps/*.md` keeps calling `finish.sh` by the same path/args).
- Forward `HOME` in the shim's env allowlist, matching `spawn_issue.sh`'s precedent — `gh` (invoked transitively via `github.sh mark-split`, both in shell mode and inside the native module `node` is writing) needs it once `engine_dispatch` strips the ambient environment for a native call.

## Implementation Steps

### Step 1 — Split `finish.sh` into a shell implementation and a thin `engine_dispatch` shim

Rename the current `arcanum-split-issue/scripts/finish.sh` to `arcanum-split-issue/scripts/finish_shell.sh`, content unchanged (this becomes the shell-mode implementation and the fallback whenever `engine.mode=native` is configured but nothing else changes). Then write a new, thin `arcanum-split-issue/scripts/finish.sh` that sources `arcanum/_lib/engine_dispatch.sh` and delegates:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="${1:-}"
ISSUE_ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ISSUE_ID" ]] || {
  echo "Usage: $0 <repo_path> <issue_id>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-split-issue-finish "${SCRIPT_DIR}/finish_shell.sh" HOME -- "$@"
```

Follow `arcanum/_lib/spawn_issue.sh` (the `spawn-issue` migration's shim) as the closest precedent for header comments and shape.

### Step 2 — Flip the migration-status flag

Add `"arcanum-split-issue-finish": true` to `arcanum/_lib/migration-status.json`, changing it from its current `false`. Do this once `node`'s `core/lib/ArcanumSplitIssueFinish.js` and its `core/bin/arcanum` registration exist, so the flag never points at a missing native module.

## Files to Change

- `arcanum-split-issue/scripts/finish.sh` — replaced with the thin `engine_dispatch` shim.
- `arcanum-split-issue/scripts/finish_shell.sh` — new file, exact rename of the previous `finish.sh` content.
- `arcanum/_lib/migration-status.json` — flip `arcanum-split-issue-finish` to `true`.

## Notes

- No other script in the repo calls `finish.sh` by a path that would need updating — `arcanum-split-issue`'s own `.md` steps already just call it as `finish.sh <repo_path> <id>` and are engine-agnostic per the shim's unchanged CLI contract.
- `finish_shell.sh` itself needs no code changes — only the rename — since `set -euo pipefail`, the `github.sh mark-split` call, and the `safe_branch_checkout` sourcing all keep working identically as the shell fallback implementation.
