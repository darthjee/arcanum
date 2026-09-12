# scripter Plan: Migrate discuss-issue-confirm entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces `discuss-issue/scripts/confirm_shell.sh` (the renamed, content-unchanged shell implementation) at the exact path node's parity test will invoke directly.
- Produces the `discuss-issue/scripts/confirm.sh` shim that calls `engine_dispatch` with command name `discuss-issue-confirm` — this exact string must match node's `COMMANDS` map key and the `arcanum/_lib/migration-status.json` key.
- The shim forwards no environment variables and takes no `<repo_path>` argument (the script's existing three callers all invoke `confirm.sh "<reply>"` with nothing else) — `REPO_PATH` for the `engine_dispatch` call itself is derived internally via `git rev-parse --show-toplevel`, mirroring `auto-fix-issue/scripts/list_plan_agents.sh`.

## Implementation Steps

### Step 1 — Split the script into a shell implementation and an engine_dispatch shim

Rename `discuss-issue/scripts/confirm.sh` to `discuss-issue/scripts/confirm_shell.sh`, content unchanged (this is the existing, working shell logic — no behavior change).

Create a new `discuss-issue/scripts/confirm.sh` as a thin `engine_dispatch` shim, mirroring `auto-fix-issue/scripts/list_plan_agents.sh`'s shape (no `<repo_path>` argument, no env allowlist) rather than a commit-style shim's (those take `<repo_path>` as `$1` and validate every required argument up front):

```bash
#!/usr/bin/env bash
# Thin engine_dispatch shim for the "discuss-issue-confirm" migrated
# entrypoint — see docs/agents/architecture/script-engine.md and
# docs/agents/plans/447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js/plan.md
# for the full design/shared contracts. Deterministically resolves a
# free-form yes/no-ish reply to a boolean (exit code only, no stdout),
# via either the shell implementation (confirm_shell.sh) or the native
# one (core/bin/arcanum), per engine.mode / arcanum/_lib/migration-status.json.
#
# No env vars are forwarded to the native path's allowlist — this
# entrypoint does no git/GitHub/filesystem I/O, only string
# normalization on its one argument.
#
# Usage: confirm.sh "<free-form reply>"
#
# Unlike commit_change.sh/merge_main.sh, this entrypoint does not take
# <repo_path> as its own argument — every existing caller invokes it as
# `confirm.sh "<reply>"`. engine_dispatch() still needs a repo_path for
# its config_chain_read call, so it is derived here from the ambient git
# checkout, the same convention list_plan_agents.sh uses.
#
# Output and exit code: unchanged from before this migration — see
# confirm_shell.sh's own header for the full behavior contract. Note
# there is deliberately NO argument-presence check here (unlike most
# other shims): confirm_shell.sh itself never errors or prints anything
# on a missing/empty reply, it just exits 1 the same as any other
# non-affirmative reply — adding a validation block here would diverge
# from that contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

engine_dispatch "$REPO_PATH" discuss-issue-confirm "${SCRIPT_DIR}/confirm_shell.sh" -- "$@"
```

### Step 2 — Mark the entrypoint migrated

Add `"discuss-issue-confirm": true` to `arcanum/_lib/migration-status.json`, keeping the file's existing key ordering/formatting conventions.

## Files to Change

- `discuss-issue/scripts/confirm.sh` — replace with the `engine_dispatch` shim.
- `discuss-issue/scripts/confirm_shell.sh` — new file, the renamed original shell implementation (unchanged content).
- `arcanum/_lib/migration-status.json` — flip `discuss-issue-confirm` to `true`.

## Notes

- No caller of `discuss-issue/scripts/confirm.sh` needs updating — the shim keeps the same filename and argument contract, so all three existing call sites (`arcanum-split-issue/steps/split.md`, `discuss-issue/steps/discuss_and_save.md`, `init-claude/setup_labels.md`) are unaffected.
- Do not add a pre-dispatch usage/argument check to the shim — see this file's header comment above and the main plan's "Silent exit-only contract" note for why that would break parity.
