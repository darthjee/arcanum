# Fix the REST-path call in monitor_pr_shell.sh

`auto-monitor-pr/scripts/monitor_pr_shell.sh` currently resolves only `REPO_REF=$(get_repo_ref "$REPO_PATH")` (line 104) and reuses it both for `gh pr view -R "$REPO_REF"` (fine — `-R` tolerates the domain-qualified form) and for the raw REST path `gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments"` (line 195 — breaks under an SSH-proxy-style origin, since a raw REST path needs bare `owner/repo`).

Add a second resolved variable, `REPO_SLUG=$(get_repo_path "$REPO_PATH")`, right next to the existing `REPO_REF` line — mirroring the exact pattern already used in `auto-fix-all/scripts/wait_ci_shell.sh` (`REPO_REF=$(get_repo_ref ...)` + `REPO_SLUG=$(get_repo_path ...)`, with `REPO_SLUG` reserved for the raw REST call). Then change the REST call on line 195 from:

```sh
review_comments=$(gh api "repos/${REPO_REF}/pulls/${PR_NUMBER}/comments" 2>/dev/null) || {
  echo "pending"
  exit 0
}
```

to use `${REPO_SLUG}` instead of `${REPO_REF}`. Leave the `gh pr view -R "$REPO_REF"` call (line 161) untouched — `-R` already tolerates the host-prefixed form, and `get_repo_ref`'s existing behavior stays correct for that use.

While in that failure block, add a diagnostic line to stderr before the existing `echo "pending"; exit 0`, e.g.:

```sh
review_comments=$(gh api "repos/${REPO_SLUG}/pulls/${PR_NUMBER}/comments" 2>/dev/null) || {
  echo "Warning: gh api repos/${REPO_SLUG}/pulls/${PR_NUMBER}/comments failed" >&2
  echo "pending"
  exit 0
}
```

This keeps the exact same stdout/exit-code contract (`pending`, exit 0) on failure, but makes a REST failure distinguishable from a genuine "no reviewable state yet" pending result when reading logs. Do not add this stderr logging to the other `|| { echo "pending"; exit 0; }` fallbacks in the file (e.g. around `gh pr view` or the `jq` parses) — this issue is scoped to the REST-path call specifically.

No changes needed to `arcanum/_lib/origin.sh` itself — `get_repo_path` already exists and already returns the bare `owner/repo` for any origin shape (already exercised, for a different call site, by `wait_ci_shell.sh`).

## Files to Change

- `auto-monitor-pr/scripts/monitor_pr_shell.sh` — resolve `REPO_SLUG` via `get_repo_path`, use it (not `REPO_REF`) in the `gh api repos/.../pulls/.../comments` call, and log that call's failure to stderr before falling back to `pending`.
