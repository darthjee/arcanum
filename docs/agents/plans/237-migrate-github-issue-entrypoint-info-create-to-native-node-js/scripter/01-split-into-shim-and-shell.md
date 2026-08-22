# Split github_issue.sh into shell impl + engine_dispatch shim

Today, `arcanum/_lib/github_issue.sh` is a single monolithic script (case statement over 10 sub-commands) called directly by every caller — no `engine_dispatch` shim exists for it at all, unlike every other already-migrated entrypoint. Introduce that split now, for `info`/`create` only.

## 1. Rename the existing file

`git mv arcanum/_lib/github_issue.sh arcanum/_lib/github_issue_shell.sh` — its contents are otherwise **unchanged** (same `cmd_*` functions, same case statement, same usage text). This becomes the shell implementation, matching the `*_shell.sh` naming convention used by `resolve_and_fetch_shell.sh`, `checkout_safe_branch_shell.sh`, `resolve_id_and_file_shell.sh`, `resolve_plan_paths_shell.sh`, `list_agents_shell.sh`.

## 2. Add two tiny fixed wrapper scripts

These exist solely to bake the sub-command name in at the shell layer, so `engine_dispatch`'s own shared trailing-args stay identical between its shell-fallback and native branches (see plan.md's shared contracts for why this is necessary — the naive one-liner `-- "$subcommand" "$@"` would leak the sub-command into the native call too).

`arcanum/_lib/github_issue_info_shell.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_issue_shell.sh" info "$@"
```

`arcanum/_lib/github_issue_create_shell.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_issue_shell.sh" create "$@"
```

Mark both executable (`chmod +x`), matching every other script in `arcanum/_lib/`.

## 3. Write the new thin shim at `arcanum/_lib/github_issue.sh`

```bash
#!/usr/bin/env bash
# Thin per-sub-command engine_dispatch shim for the "github-issue"
# migrated entrypoint — see docs/agents/architecture/script-engine.md
# and docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/plan.md
# for the full design/shared contracts. Only `info`/`create` route
# through engine_dispatch; `fetch`/`update`/`mark-*` call the shell
# implementation directly, unchanged — they have no migration-status.json
# key yet, so dispatching them through engine_dispatch would only add a
# pointless always-false lookup (and print its "no native implementation
# yet" warning on every single call, forever, until their own sub-issues
# land).
#
# Usage: github_issue.sh <command> [args...]  (unchanged from before)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/engine_dispatch.sh"

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { echo "Usage: $0 <command> [args]" >&2; exit 1; }
shift

REPO_PATH="${1:-}"
[[ -n "$REPO_PATH" ]] || { echo "Usage: $0 $COMMAND <repo_path> [...]" >&2; exit 1; }

case "$COMMAND" in
  info)
    engine_dispatch "$REPO_PATH" github-issue-info "${SCRIPT_DIR}/github_issue_info_shell.sh" HOME -- "$@"
    ;;
  create)
    engine_dispatch "$REPO_PATH" github-issue-create "${SCRIPT_DIR}/github_issue_create_shell.sh" HOME -- "$@"
    ;;
  *)
    exec "${SCRIPT_DIR}/github_issue_shell.sh" "$COMMAND" "$@"
    ;;
esac
```

Note `"$@"` here (after `$COMMAND` was shifted off) is `<repo_path>` for `info` or `<repo_path> <title> <file>` for `create` — never includes the sub-command name, on either the shell-fallback or native path, since `engine_dispatch` forwards these same trailing args to both `bash github_issue_info_shell.sh "$@"`/`bash github_issue_create_shell.sh "$@"` (which each prepend the sub-command themselves) and `core/bin/arcanum github-issue-info "$@"`/`core/bin/arcanum github-issue-create "$@"` (which don't need it — it's already in the routing key).

## 4. Verify every existing caller still works unchanged

Every caller of `arcanum/_lib/github_issue.sh` (`discuss-issue/scripts/github.sh`, `auto-new-issue/scripts/github.sh`, `arcanum-split-issue/scripts/github.sh`, `enhance-issue/scripts/github.sh`, `resolve_and_fetch_shell.sh`, `spawn_issue.sh`) invokes it as `github_issue.sh <command> <repo_path> [...]` — the new shim's argv contract is identical to the old monolithic script's, so none of these callers need any change. Spot-check at least one `fetch`/`update`/`mark-*` call path (e.g. `resolve_and_fetch_shell.sh`'s `fetch` call) manually to confirm the `*)` branch's `exec` still behaves exactly as the old direct call did.

## Files to Change

- `arcanum/_lib/github_issue.sh` → `arcanum/_lib/github_issue_shell.sh` (git mv, no content change).
- `arcanum/_lib/github_issue.sh` — new (the shim, replacing the moved-away file).
- `arcanum/_lib/github_issue_info_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_create_shell.sh` — new wrapper.
