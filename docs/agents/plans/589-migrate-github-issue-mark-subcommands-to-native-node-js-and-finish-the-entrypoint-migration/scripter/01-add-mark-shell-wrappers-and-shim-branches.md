# Add mark-* shell wrappers and shim branches

Create one wrapper per subcommand, shaped exactly like `arcanum/_lib/github_issue_fetch_shell.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/github_issue_shell.sh" mark-created "$@"
```

Make them executable (`chmod +x`, the same mode as the existing `github_issue_*_shell.sh` files).

In `arcanum/_lib/github_issue.sh`, add six `case` branches after `update)`, following the `fetch)` pattern:

```bash
  mark-created)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 mark-created <repo_path> <id>" >&2; exit 1; }
    engine_dispatch "$REPO_PATH" github-issue-mark-created "${SCRIPT_DIR}/github_issue_mark_created_shell.sh" HOME -- "$@"
    ;;
```

Repeat for `mark-refined`, `mark-ready`, `mark-enhancing`, `mark-planning` and `mark-split`. At this point `$1` is `<repo_path>` (the command was already shifted off) and `$2` is `<id>`, the same as in `fetch)`.

## Files to Change
- `arcanum/_lib/github_issue_mark_created_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_mark_refined_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_mark_ready_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_mark_enhancing_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_mark_planning_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue_mark_split_shell.sh` — new wrapper.
- `arcanum/_lib/github_issue.sh` — six new dispatch branches.
