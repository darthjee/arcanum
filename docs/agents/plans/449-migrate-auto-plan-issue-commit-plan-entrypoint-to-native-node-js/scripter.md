# scripter Plan: Migrate auto-plan-issue-commit-plan entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The extracted `commit_plan_shell.sh` must keep today's exact CLI contract and behavior (`git add`, template-aware `"architect"` agent-email resolution, commit message/trailers, commit, push, relayed stdout) — `node`'s parity test asserts its stdout/exit code byte-for-byte against the native `AutoPlanIssueCommitPlan.js`.
- The dispatch key and `migration-status.json` flag name must both be the literal string `auto-plan-issue-commit-plan`, matching the key `node` registers in `core/lib/core/commands.js`.

## Implementation Steps

### Step 1 — Extract the shell logic to commit_plan_shell.sh

Move `auto-plan-issue/scripts/commit_plan.sh`'s current body verbatim into a new `auto-plan-issue/scripts/commit_plan_shell.sh`, unchanged in behavior — same usage message, same `repo_path_enter`/`plan_dir` check, same `git add`, template-engine branch, commit message/trailers, `git commit -F -`, and `push_current_branch` call.

### Step 2 — Shim commit_plan.sh over engine_dispatch, flip the migration flag

Replace `auto-plan-issue/scripts/commit_plan.sh` with a thin `engine_dispatch.sh` shim, following `auto-fix-issue/scripts/commit_change.sh`'s exact pattern:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="${1:-}"
PLAN_DIR="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$REPO_PATH" && -n "$PLAN_DIR" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <plan_dir> <id> <model_name> <model_email>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-plan-issue-commit-plan "${SCRIPT_DIR}/commit_plan_shell.sh" HOME -- "$@"
```

Forward `HOME` (same reasoning as `commit_change.sh`'s shim: `git`, called throughout the shell implementation, needs it to resolve identity/config once native mode's `env -i PATH="$PATH"` strips the ambient environment).

Add `"auto-plan-issue-commit-plan": true` to `arcanum/_lib/migration-status.json` (currently `false`), once `node`'s native command is in place.

Verify the shim routes correctly both ways: with `engine.mode=shell` it must invoke `commit_plan_shell.sh` directly; with `engine.mode=native` it must dispatch to `core/bin/arcanum auto-plan-issue-commit-plan` instead — spot-check both locally before considering this step done (the native-mode path also depends on `node`'s registration landing first).

## Files to Change

- `auto-plan-issue/scripts/commit_plan_shell.sh` — new, extracted verbatim from today's `commit_plan.sh`.
- `auto-plan-issue/scripts/commit_plan.sh` — replaced with a thin `engine_dispatch.sh` shim.
- `arcanum/_lib/migration-status.json` — flip `auto-plan-issue-commit-plan` to `true`.

## Notes

- Land Step 1 (extraction) before `node` needs to write the parity test against it; Step 2's flag flip should land last, after `node`'s native command is registered, so `engine.mode=native` has something real to dispatch to.
