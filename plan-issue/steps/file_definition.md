# Plan File Definition

Run:

```bash
../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```

> Resolve `../auto-plan-issue/scripts/resolve_plan_paths.sh` relative to the `plan-issue` skill folder (i.e., `<plan-issue>/scripts/../../../auto-plan-issue/scripts/resolve_plan_paths.sh`).

The argument `<id>` may be in the form `99` or `#99` — strip the leading `#` if present before passing to the script. The ID must be numeric and tied to a real GitHub issue; the script enforces this and will error otherwise.

Parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If the script fails (no issue file found for `<id>`), stop and inform the user.
- Read `ISSUE_FILE` to understand the issue.
- If `PLAN_EXISTS=true`, read the existing plan file(s) in `PLAN_DIR` and skip directly to the "Present an overview" section in [write_and_confirm.md](write_and_confirm.md).
