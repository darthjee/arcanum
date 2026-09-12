# Scripter Plan: Migrate auto-new-issue-commit-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command key `auto-new-issue-commit-issue`, native module
  `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` — see
  [node.md](node.md) for the node side. `node` needs the shim in place before
  its own parity spec (`node`'s step 4) can actually pass.
- `commit_issue_shell.sh`'s own CLI keeps `<repo_path>` as its first positional
  argument (same shape as `commit_change_shell.sh`), so the shim passes
  `"$@"` straight through with **no** `--prepend-repo-path` flag.

## Implementation Steps

### Step 1 — Extract the shell implementation

Copy the current `auto-new-issue/scripts/commit_issue.sh` verbatim to
`auto-new-issue/scripts/commit_issue_shell.sh` (keep its shebang, header
comment, and full body unchanged — it remains the actual shell
implementation, just renamed).

### Step 2 — Replace commit_issue.sh with a thin engine_dispatch shim

Replace `auto-new-issue/scripts/commit_issue.sh`'s contents with a thin
`engine_dispatch.sh`-sourcing shim, modeled directly on
`auto-plan-issue/scripts/commit_plan.sh`:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-new-issue-commit-issue" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js/node.md
# for the full design/shared contracts. Stages and commits an issue file
# created by the auto-new-issue skill, via either the shell implementation
# (commit_issue_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# HOME is forwarded to the native path's explicit env-var allowlist — git
# (called throughout the shell implementation) needs it to resolve
# identity/config once native's `env -i PATH="$PATH"` strips the ambient
# environment down.
#
# Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>
#
# Output and exit code: unchanged from before this migration — see
# commit_issue_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
FILE_PATH="${2:-}"
ID="${3:-}"
MODEL_NAME="${4:-}"
MODEL_EMAIL="${5:-}"

[[ -n "$REPO_PATH" && -n "$FILE_PATH" && -n "$ID" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <file_path> <id> <model_name> <model_email>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-new-issue-commit-issue "${SCRIPT_DIR}/commit_issue_shell.sh" HOME -- "$@"
```

Verify both routing modes work end-to-end against a fixture repo (once
`node`'s module and `migration-status.json` flip are in place):
`engine.mode=shell` runs `commit_issue_shell.sh` directly; `engine.mode=native`
routes through `core/bin/arcanum auto-new-issue-commit-issue`.

## Files to Change

- `auto-new-issue/scripts/commit_issue_shell.sh` — new file, the extracted
  (unchanged) shell implementation.
- `auto-new-issue/scripts/commit_issue.sh` — replaced with the thin
  `engine_dispatch` shim.

## CI Checks

- `core`: `yarn test` (CI job: `test`) — the parity spec
  (`core/spec/bin/autoNewIssueCommitIssueParity_spec.js`, see
  [node/04-parity-test.md](node/04-parity-test.md)) exercises
  `commit_issue_shell.sh` directly.

## Notes

- Do not add a standalone `_lib` migration here — `commit_template_engine_get`
  and `agent_email_get` stay sourced from `arcanum/_lib/commit_template.sh`/
  `arcanum/_lib/agent_email.sh` inside `commit_issue_shell.sh` unchanged; only
  the entrypoint script itself splits into shell/shim, per
  `script-engine.md`'s "no standalone, wholesale `_lib` migration" rule.
