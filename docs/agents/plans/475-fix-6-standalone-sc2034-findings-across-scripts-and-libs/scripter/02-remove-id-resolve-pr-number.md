# Remove unused ID in resolve_pr_number.sh

`resolve_pr_number.sh` is a thin `engine_dispatch` shim: after assigning `ID="${2:-}"` (line 23), it forwards the original, unmodified `"$@"` straight into `engine_dispatch`. The `ID` variable itself is never read anywhere in the file — it exists only as a leftover from before the shim migration. Delete the assignment; forwarding still works exactly the same via `"$@"`.

## Files to Change

- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — delete the `ID="${2:-}"` line (line 23). Leave `REPO_PATH="${1:-}"` and every other line untouched.
