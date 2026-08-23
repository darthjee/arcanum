# Scripter Plan: Migrate auto-fix-all-wait-ci-and-merge entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The shim's `engine_dispatch` call uses `<command>` = `"auto-fix-all-wait-ci-and-merge"` — the exact key `node` registers in `core/bin/arcanum`'s `COMMANDS` map, and the exact key flipped to `true` in `arcanum/_lib/migration-status.json` by this plan's Step 2.
- Output/exit contract to preserve unchanged in the extracted `wait_ci_and_merge_shell.sh`: `passed\n<url>\n` on CI-passed-and-merged, `failed\n<name>\n...` on CI-failed (merge never attempted), non-zero exit on a hard failure — see `plan.md`'s Shared contracts for the full detail.

## Implementation Steps

### Step 1 — Turn `wait_ci_and_merge.sh` into a thin `engine_dispatch` shim

Extract the current contents of `auto-fix-all/scripts/wait_ci_and_merge.sh` into a new `auto-fix-all/scripts/wait_ci_and_merge_shell.sh`, unchanged, and replace `wait_ci_and_merge.sh` itself with a thin shim — same pattern `auto-fix-all-wait-ci` (#262) and `auto-fix-all-queue` (#264) already established for `wait_ci.sh`/`queue.sh`:

```bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:?Usage: $0 <repo_path> [model_email]}"
MODEL_EMAIL="${2:-}"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" auto-fix-all-wait-ci-and-merge "${SCRIPT_DIR}/wait_ci_and_merge_shell.sh" HOME -- "$REPO_PATH" "$MODEL_EMAIL"
```

`HOME` is forwarded to the native path, mirroring `wait_ci.sh`'s own forwarding — the orchestrated native calls (`AutoFixAllWaitCi`, `AutoFixAllGithub`) resolve GitHub credentials via `gh auth token` internally (`GithubToken.js`), which needs `HOME` once native's `env -i PATH="$PATH"` strips the ambient environment down.

Preserve `wait_ci_and_merge_shell.sh`'s own header comment (the output-contract documentation currently in `wait_ci_and_merge.sh`) verbatim in the extracted file, same as `wait_ci_shell.sh` did.

### Step 2 — Flip the migration-status flag

Set `"auto-fix-all-wait-ci-and-merge"` from `false` to `true` in `arcanum/_lib/migration-status.json` — the flag `engine_dispatch.sh` reads (via `_engine_dispatch_native_available`) to decide whether `engine.mode=native` actually routes to the new `core/bin/arcanum auto-fix-all-wait-ci-and-merge` command or falls back to the shell implementation.

## Files to Change

- `auto-fix-all/scripts/wait_ci_and_merge.sh` — rewritten into a thin `engine_dispatch` shim.
- `auto-fix-all/scripts/wait_ci_and_merge_shell.sh` — new file, holding the original orchestration logic unchanged.
- `arcanum/_lib/migration-status.json` — flip `"auto-fix-all-wait-ci-and-merge"` to `true`.

## Notes

- No shellcheck/bats CI job currently covers `auto-fix-all/scripts/` in `.circleci/config.yml`, so no `## CI Checks` entry applies here.
