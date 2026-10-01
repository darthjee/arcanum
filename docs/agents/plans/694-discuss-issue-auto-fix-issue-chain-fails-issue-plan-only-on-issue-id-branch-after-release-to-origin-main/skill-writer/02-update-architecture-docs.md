# Update architecture docs

Bring the architecture docs in line with the new flow:

- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md`
  - The `checkout_from_main.sh` bullet now names both callers: `auto-fix-all/steps/process_one_issue.md` and `auto-fix-issue/steps/run.md` Step 1.
  - Remove the `merge_main.sh` bullet.
  - In the "Closing checkout" bullet, note that `plan-issue` also releases `issue-<id>` after committing the plan. A chained or standalone `/auto-fix-issue` re-checks it out itself, so releasing before the chain is safe.
- `docs/agents/architecture/entrypoint-migration-status.md` — remove the `auto-fix-issue-create-branch` and `auto-fix-issue-merge-main` rows.
- Run `grep -rn "create_branch\|merge_main\|auto-fix-issue-create-branch\|auto-fix-issue-merge-main" --include=*.md . | grep -v "docs/agents/plans\|docs/agents/issues"` and fix any other live reference. Historical plans and issues stay untouched.

## Files to Change
- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md` — callers of `checkout_from_main.sh`, drop `merge_main.sh`, closing-checkout note.
- `docs/agents/architecture/entrypoint-migration-status.md` — drop the two removed entrypoints.
