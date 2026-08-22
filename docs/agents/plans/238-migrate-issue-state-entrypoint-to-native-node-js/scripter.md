# scripter Plan: Migrate issue-state entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Shell fallback filename: `arcanum/_lib/issue_state_shell.sh` — the exact extracted body of today's `issue_state.sh`, unchanged in behavior. node's parity test invokes this file directly.
- The shim (`issue_state.sh`) must dispatch under the command name `issue-state`, forwarding its own args unchanged (`<repo_path> <subcommand> <id> <field> [value]`) — matching the `checkout-safe-branch`/`resolve-plan-paths` shim pattern.
- Depends on node registering `issue-state` in `core/bin/arcanum`'s `COMMANDS` map before this shim's native path can be exercised end-to-end (the shim itself works before that lands too, since `engine_dispatch` falls back to the shell path whenever `migration-status.json`'s `issue-state` key is still `false`).

## Implementation Steps

### Step 1 — Extract the shell implementation

Copy `arcanum/_lib/issue_state.sh`'s current full body (the `set -uo pipefail` header through the closing `esac`) verbatim into a new `arcanum/_lib/issue_state_shell.sh`, keeping its shebang and behavior completely unchanged — this becomes the `engine_dispatch` fallback and the shell side of node's parity test.

### Step 2 — Convert issue_state.sh into a thin dispatch shim

Rewrite `arcanum/_lib/issue_state.sh` into a thin shim following `checkout_safe_branch.sh`'s shape exactly:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "issue-state" migrated entrypoint —
# see docs/agents/architecture/script-engine.md and
# docs/agents/plans/238-migrate-issue-state-entrypoint-to-native-node-js/plan.md.
#
# Usage: issue_state.sh <repo_path> get <id> <field>
#        issue_state.sh <repo_path> set <id> <field> <value>
#        issue_state.sh <repo_path> set-json <id> <field> <json_value>
#        issue_state.sh <repo_path> append-json <id> <field> <json_value>

set -euo pipefail

REPO_PATH="${1:-}"

[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 <repo_path> get|set|set-json|append-json <id> <field> [value]" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" issue-state "${SCRIPT_DIR}/issue_state_shell.sh" -- "$@"
```

Note: unlike `checkout_safe_branch.sh` (single arg), `issue_state.sh`'s own usage validation only checks `REPO_PATH` is non-empty here — `issue_state_shell.sh`'s own full arg validation (command/id/field required) still runs as before, on whichever side (shell fallback or native) `engine_dispatch` actually invokes. Don't duplicate that validation in the shim.

## Files to Change

- `arcanum/_lib/issue_state_shell.sh` — new file, extracted body of today's `issue_state.sh`.
- `arcanum/_lib/issue_state.sh` — rewritten into the thin shim above.

## CI Checks

No CI job runs `arcanum/_lib/*.sh` directly today (the `.circleci/config.yml` `test`/`checks` jobs are `core/`-scoped) — coverage for this change comes from node's parity test instead.

## Notes

- No env-var allowlist entries needed for the native path (`issue_state.sh` is purely filesystem-based, same as `checkout_safe_branch.sh`'s note).
