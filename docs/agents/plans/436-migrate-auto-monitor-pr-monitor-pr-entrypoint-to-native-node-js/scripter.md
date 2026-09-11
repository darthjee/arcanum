# scripter Plan: Migrate auto-monitor-pr-monitor-pr entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section for the command name (`auto-monitor-pr-monitor-pr`), the CLI surface split (`<repo_path>` consumed by the shim, `--pr-number`/`--issue-id` passed through as `args`), the `HOME`-only env allowlist, and the exact usage-error string both implementations must independently produce.

## Implementation Steps

### Step 1 — Extract the current body into monitor_pr_shell.sh

Copy `auto-monitor-pr/scripts/monitor_pr.sh` verbatim to `auto-monitor-pr/scripts/monitor_pr_shell.sh` — no behavioral changes, this is the fallback/`engine.mode=shell` implementation going forward. Follow `resolve_pr_number_shell.sh`'s precedent: it keeps the original script's header comment and body untouched.

### Step 2 — Replace monitor_pr.sh with the engine_dispatch shim

Rewrite `auto-monitor-pr/scripts/monitor_pr.sh` as a thin shim, following `resolve_pr_number.sh`'s exact shape:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-monitor-pr-monitor-pr" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Single-pass check for
# merge/close/approval/new-owner-comments on a PR, via either the shell
# implementation (monitor_pr_shell.sh) or the native one (core/bin/arcanum),
# per engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# needed for `gh`/token resolution once native's `env -i PATH="$PATH"`
# strips the ambient environment, same rationale as resolve_pr_number.sh
# and run_checks.sh.
#
# Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]
#
# Output and exit code: unchanged from before this migration — see
# monitor_pr_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-monitor-pr-monitor-pr "${SCRIPT_DIR}/monitor_pr_shell.sh" HOME -- "$@"
```

Double-check the `shift || true` against `resolve_pr_number.sh`'s actual pattern (it does not shift `REPO_PATH` off before calling `engine_dispatch` — it passes `"$@"` including `$1` again since `engine_dispatch`'s own signature takes `<repo_path>` as its own first arg, separately from the trailing `-- "$@"` args). Verify by re-reading `resolve_pr_number.sh`'s final two lines before writing this file — do not shift `--pr-number`/`--issue-id` out of `$@` by mistake, since `engine_dispatch` needs the FULL remaining arg list (everything after `<repo_path>`) forwarded after `--`.

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr_shell.sh` (new — verbatim copy of the current `monitor_pr.sh`)
- `auto-monitor-pr/scripts/monitor_pr.sh` (rewritten — thin shim)

## Notes

- No CI job runs shell scripts directly in this repo (only `core`'s `yarn test`/`yarn lint`, per `.circleci/config.yml`) — this shim's correctness is verified indirectly by `node`'s parity test (node/06), which invokes both `monitor_pr_shell.sh` and the native path as real subprocesses.
