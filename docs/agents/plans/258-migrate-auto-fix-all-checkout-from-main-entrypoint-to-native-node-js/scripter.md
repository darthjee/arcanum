# scripter Plan: Migrate auto-fix-all-checkout-from-main entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

Only start this agent's work after node's steps land on the branch (its module + tests must exist and pass before the migration-status flip in Step 2 below makes anything actually route to it). See plan.md's "Shared contracts" for the exact shim shape, command name, and shell-fallback filename this agent produces/updates.

## Implementation Steps

### Step 1 — Split checkout_from_main.sh into an engine_dispatch shim

Rename `auto-fix-all/scripts/checkout_from_main.sh` to `auto-fix-all/scripts/checkout_from_main_shell.sh` verbatim (`git mv`, no content changes — same precedent as `reply_comment_shell.sh`/`cleanup_artifacts_shell.sh`, whose renamed content is left untouched, header included).

Write a new `auto-fix-all/scripts/checkout_from_main.sh` as the thin shim, matching `arcanum/_lib/checkout_safe_branch.sh`'s shape (header comment, usage validation, then delegation) — no extra env-var allowlist entries, since this entrypoint is purely git-based with no `gh`/network calls:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-all-checkout-from-main"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Bootstraps or reuses the
# "issue-<id>" branch merged up to date with "origin/main", via either the
# shell implementation (checkout_from_main_shell.sh) or the native one
# (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# Purely filesystem/git-based — no environment dependency, so no extra
# env-var allowlist entries (beyond PATH, which engine_dispatch always
# includes) are needed for the native path.
#
# Usage: checkout_from_main.sh <repo_path> <id>
#
# Output and exit code: unchanged from before this migration — see
# checkout_from_main_shell.sh's own header for the full contract.

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

[[ -n "$REPO_PATH" && -n "$ID" ]] || { echo "Usage: $0 <repo_path> <id>" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-checkout-from-main "${SCRIPT_DIR}/checkout_from_main_shell.sh" -- "$@"
```

No callers need updating — every existing reference (`discuss-issue/steps/discuss_and_save.md`, `auto-fix-all`'s `process_one_issue.md`, this same plan's own directions) already calls `checkout_from_main.sh` by this same path/filename.

### Step 2 — Flip the migration-status entry

In `arcanum/_lib/migration-status.json`, change `"auto-fix-all-checkout-from-main": false` to `"auto-fix-all-checkout-from-main": true`.

## Files to Change

- `auto-fix-all/scripts/checkout_from_main_shell.sh` — renamed from `checkout_from_main.sh`, content unchanged.
- `auto-fix-all/scripts/checkout_from_main.sh` — rewritten as the thin `engine_dispatch` shim above.
- `arcanum/_lib/migration-status.json` — flip the `auto-fix-all-checkout-from-main` entry to `true`.

## Notes

- Do this after node's module and both test files exist and pass locally — flipping the status entry before that would make `engine.mode=native` repos start routing to an implementation that hasn't been verified yet.
