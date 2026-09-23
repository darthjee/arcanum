# Replace the exec fallthrough with a usage error

Every `github-issue` subcommand is now dispatched, so the `*)` branch in `arcanum/_lib/github_issue.sh` no longer needs to `exec github_issue_shell.sh`. Replace it with a usage error based on `github_issue_shell.sh`'s trailing usage block, with these corrections:

- The `mark-refined` line must read `Add the Refined label and remove Created/Idea/Writting, if present`. Today it says only `Created`, but `cmd_mark_refined` also removes `idea` and `writting`.
- The `mark-planning` and `mark-split` lines have one extra space before the description. Align them with the other lines.

```bash
  *)
    echo "Usage: $0 <command> [args]" >&2
    echo "Commands:" >&2
    echo "  info <repo_path>                            Print DOMAIN and REPO from git origin" >&2
    ...
    echo "  mark-refined <repo_path> <id>               Add the Refined label and remove Created/Idea/Writting, if present" >&2
    ...
    echo "  mark-planning <repo_path> <id>              Add the Planning label and remove Idea/Writting/Created, if present" >&2
    echo "  mark-split <repo_path> <id>                 Add the Split label and remove Planning, if present" >&2
    exit 1
    ;;
```

Behavior change: an unknown subcommand now fails in the shim (exit 1, same usage text) instead of in `github_issue_shell.sh` (also exit 1). Only the `$0` in the first line changes. That line now names `github_issue.sh`, or the per-skill `scripts/github.sh` wrapper that `exec`s it; `exec` preserves `$0` as the target path, so it is `.../arcanum/_lib/github_issue.sh` either way.

Also rewrite the header comment of `github_issue.sh`:
- Drop the sentence saying `mark-*` still call the shell implementation directly until #589.
- Say that all ten subcommands route through `engine_dispatch`, that `fetch`/`update`/`mark-*` check their positional arguments before dispatching, and that unknown subcommands get the usage error above. Add this issue's plan path to the list of referenced plans.
- Replace `Usage: github_issue.sh <command> [args...]  (unchanged from before)` with a copy of the corrected command list, so the header documents the full surface.

Leave `arcanum/_lib/github_issue_shell.sh` unchanged. Fixing its own `mark-refined` usage/header line is optional; deleting the file is a later cleanup, out of scope here.

## Files to Change
- `arcanum/_lib/github_issue.sh` — replace the `*)` `exec` with the usage error, and rewrite the header comment.
