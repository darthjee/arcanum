# Move more monitor-PR logic into the script

## Context

The `auto-fix-all` skill's `monitor_pr` step ([auto-fix-all/steps/monitor_pr.md](../../../auto-fix-all/steps/monitor_pr.md)) currently requires three separate calls before it can start monitoring a PR: resolving the PR number via `scripts/github.sh pr-number`, resolving the PR owner via `git config user.ghuser`, and finally invoking the blocking `scripts/monitor_pr.sh <pr_number> <pr_owner> <since_file>`. This spreads logic that could be deterministic across prose instructions and multiple script invocations, instead of being consolidated in the script itself.

## What needs to be done

Add a `monitor` command to `auto-fix-all/scripts/monitor_pr.sh`, callable as:

```bash
scripts/monitor_pr.sh monitor <issue_id>
```

This command should internally:
- Resolve the PR number for the current branch (same logic as `github.sh pr-number`).
- Resolve the PR owner via `git config user.ghuser`.
- Derive the since-file path as `.claude/state/auto-fix-all-<issue_id>-since.txt`.
- Run the existing blocking poll loop using those resolved values.

Update `auto-fix-all/steps/monitor_pr.md` to call this single command instead of the current three-step sequence (drop the "Resolve the PR number and owner" section's explicit `pr-number`/`git config` calls).

## Acceptance criteria

- [ ] `scripts/monitor_pr.sh monitor <issue_id>` resolves PR number, PR owner, and since-file path internally, then blocks exactly as the existing positional-argument invocation does (first output line `merged`/`closed`/`approved`/`commented`).
- [ ] The existing positional-argument form (`monitor_pr.sh <pr_number> <pr_owner> <since_file>`) keeps working, so other call sites are unaffected.
- [ ] `auto-fix-all/steps/monitor_pr.md` is updated to use the new single-call form.

---
See issue for details: https://github.com/darthjee/arcanum/issues/5
