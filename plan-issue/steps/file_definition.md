# Plan File Definition

Run:

```bash
../auto-plan-issue/scripts/resolve_plan_paths.sh "$REPO_PATH" docs/agents/issues docs/agents/plans <id>
```

> Resolve `../auto-plan-issue/scripts/resolve_plan_paths.sh` relative to the `plan-issue` skill folder (i.e., `<plan-issue>/scripts/../../../auto-plan-issue/scripts/resolve_plan_paths.sh`).

The argument `<id>` may be in the form `99` or `#99` — strip the leading `#` if present before passing to the script. The ID must be numeric and tied to a real GitHub issue; the script enforces this and will error otherwise.

Parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If the script fails (e.g. no issue file found for `<id>`), take the failed exit and end — no next-step offer:
  1. Release the working tree (a harmless no-op here, since nothing was checked out yet): `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"`.
  2. Print the `failed` report (see [Closing report](write_and_confirm.md#closing-report)) and relay it verbatim, passing `--issue <id>` only when `<id>` was numeric:

     ```bash
     ../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue --status failed [--issue <id>] \
       --summary "resolve_plan_paths.sh failed for issue #<id>: <short reason>."
     ```

     > Resolve both `../../arcanum/_lib/` scripts relative to this file's directory.
- Read `ISSUE_FILE` to understand the issue.
- If `PLAN_EXISTS=true`, read the existing plan file(s) in `PLAN_DIR` and skip directly to the "Present an overview" section in [write_and_confirm.md](write_and_confirm.md).
