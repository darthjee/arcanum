# Keep REPO in run_update_common.sh, suppress with consumer comment

`REPO` is one of `resolve_target`'s documented module-level output globals (see the function's own docstring: "Sets the module-level METHOD/REPO/TARGET_PATH globals"). The flagged assignment, `REPO="$(parse_github_owner_repo "$TARGET_PATH" || true)"` (line 42, the `.git`-present/git-method branch), is read by `run_update_check_shell.sh` via `echo "REPO=${REPO}"`. Add a `# shellcheck disable=SC2034` comment above this assignment naming that consumer, and leave the assignment untouched.

## Files to Change

- `arcanum-update/scripts/run_update_common.sh` — add `# shellcheck disable=SC2034 # consumed by run_update_check_shell.sh` immediately above the `REPO="$(parse_github_owner_repo "$TARGET_PATH" || true)"` line (line 42).
