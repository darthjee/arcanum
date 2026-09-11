# scripter Plan: Migrate auto-monitor-issue-pr-resolve-pr-number entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh` (the renamed, content-unchanged shell implementation) at the exact path node's parity test will invoke directly.
- Produces the `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` shim that calls `engine_dispatch` with command name `auto-monitor-issue-pr-resolve-pr-number` — this exact string must match node's `COMMANDS` map key and the `arcanum/_lib/migration-status.json` key.
- The shim's env allowlist forwards `HOME` only — matching `auto-fix-issue/scripts/run_checks.sh` and `github.sh`'s precedent for `gh`-calling entrypoints.

## Implementation Steps

### Step 1 — Split the script into a shell implementation and an engine_dispatch shim

Rename `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` to `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh`, content unchanged (this is the existing, working shell logic — no behavior change).

Create a new `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` as a thin `engine_dispatch` shim, mirroring `auto-fix-issue/scripts/run_checks.sh` in shape:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-monitor-issue-pr-resolve-pr-number"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Resolves the PR number for the
# current branch, via either the shell implementation
# (resolve_pr_number_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# needed for `gh`/token resolution once native's `env -i PATH="$PATH"`
# strips the ambient environment down, same rationale as github.sh and
# run_checks.sh.
#
# Usage: resolve_pr_number.sh <repo_path> <id>
#
# Output and exit code: unchanged from before this migration — see
# resolve_pr_number_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
ID="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-monitor-issue-pr-resolve-pr-number "${SCRIPT_DIR}/resolve_pr_number_shell.sh" HOME -- "$@"
```

Preserve `resolve_pr_number_shell.sh`'s own `<id>` numeric-format validation inside the shell implementation itself (unchanged by this rename) — the shim does not duplicate that check, matching `run_checks.sh`'s precedent of only guarding what it must before dispatching.

### Step 2 — Mark the entrypoint migrated

Add `"auto-monitor-issue-pr-resolve-pr-number": true` to `arcanum/_lib/migration-status.json`, keeping the file's existing key ordering/formatting conventions.

## Files to Change

- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — replace with the `engine_dispatch` shim.
- `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh` — new file, the renamed original shell implementation (unchanged content).
- `arcanum/_lib/migration-status.json` — flip `auto-monitor-issue-pr-resolve-pr-number` to `true`.

## Notes

- No caller of `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` needs updating — the shim keeps the same filename and argument contract.
- Do not touch `arcanum/_lib/origin.sh` or `arcanum/_lib/issue_state.sh` — per `docs/agents/architecture/script-engine.md`'s "no standalone, wholesale `_lib` migration" rule; node re-derives (or reuses already-migrated) equivalents natively rather than this issue migrating those helpers wholesale.
