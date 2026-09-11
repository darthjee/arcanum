# scripter Plan: Migrate auto-fix-issue-commit-change entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces `auto-fix-issue/scripts/commit_change_shell.sh` (the renamed, content-unchanged shell implementation) at the exact path node's parity test will invoke directly.
- Produces the `auto-fix-issue/scripts/commit_change.sh` shim that calls `engine_dispatch` with command name `auto-fix-issue-commit-change` — this exact string must match node's `COMMANDS` map key and the `arcanum/_lib/migration-status.json` key.
- The shim's env allowlist forwards `HOME` only (no `GH_TOKEN`/`SSH_AUTH_SOCK`) — matching every other git-committing/pushing shim in the repo.

## Implementation Steps

### Step 1 — Split the script into a shell implementation and an engine_dispatch shim

Rename `auto-fix-issue/scripts/commit_change.sh` to `auto-fix-issue/scripts/commit_change_shell.sh`, content unchanged (this is the existing, working shell logic — no behavior change).

Create a new `auto-fix-issue/scripts/commit_change.sh` as a thin `engine_dispatch` shim, mirroring `auto-fix-all/scripts/cleanup_artifacts.sh` exactly in shape:

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "auto-fix-issue-commit-change"
# migrated entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/428-migrate-auto-fix-issue-commit-change-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Commits changes already staged by
# a specialist agent, via either the shell implementation
# (commit_change_shell.sh) or the native one (core/bin/arcanum), per
# engine.mode / arcanum/_lib/migration-status.json.
#
# `HOME` is forwarded to the native path's explicit env-var allowlist —
# `git` (called throughout the shell implementation) needs it to resolve
# identity/config once native's `env -i PATH="$PATH"` strips the ambient
# environment down; without it, native-mode commits would fail in a way
# shell-mode never does.
#
# Usage: commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]
#
# Output and exit code: unchanged from before this migration — see
# commit_change_shell.sh's own header for the full behavior contract.

set -euo pipefail

REPO_PATH="${1:-}"
TYPE="${2:-}"
SCOPE="${3:-}"
ID="${4:-}"
SUBJECT="${5:-}"
AGENT="${6:-}"
MODEL_NAME="${7:-}"
MODEL_EMAIL="${8:-}"

[[ -n "$REPO_PATH" && -n "$TYPE" && -n "$SCOPE" && -n "$ID" && -n "$SUBJECT" && -n "$AGENT" && -n "$MODEL_NAME" && -n "$MODEL_EMAIL" ]] || {
  echo "Usage: $0 <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-issue-commit-change "${SCRIPT_DIR}/commit_change_shell.sh" HOME -- "$@"
```

Preserve the required-argument usage check in the shim (mirroring `cleanup_artifacts.sh`'s own pre-dispatch validation) so a missing required argument fails the same way regardless of `engine.mode`.

### Step 2 — Mark the entrypoint migrated

Add `"auto-fix-issue-commit-change": true` to `arcanum/_lib/migration-status.json`, keeping the file's existing key ordering/formatting conventions.

## Files to Change

- `auto-fix-issue/scripts/commit_change.sh` — replace with the `engine_dispatch` shim.
- `auto-fix-issue/scripts/commit_change_shell.sh` — new file, the renamed original shell implementation (unchanged content).
- `arcanum/_lib/migration-status.json` — flip `auto-fix-issue-commit-change` to `true`.

## Notes

- No caller of `auto-fix-issue/scripts/commit_change.sh` needs updating — the shim keeps the same filename and argument contract, so every existing invocation (from `auto-fix-issue`'s own markdown steps) is unaffected.
- Do not touch `arcanum/_lib/push.sh`, `arcanum/_lib/commit_template.sh`, or `arcanum/_lib/agent_email.sh` — per `docs/agents/architecture/script-engine.md`'s "no standalone, wholesale `_lib` migration" rule, node re-derives their logic natively rather than this issue migrating them wholesale.
