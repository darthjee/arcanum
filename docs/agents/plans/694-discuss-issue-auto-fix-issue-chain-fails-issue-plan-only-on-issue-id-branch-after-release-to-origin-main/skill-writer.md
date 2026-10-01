# Skill-writer Plan: discuss-issue → auto-fix-issue chain fails: issue/plan only on issue-<id> branch after release to origin/main

Main plan: [plan.md](plan.md)

## Shared contracts

- Bootstrap with `../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` (resolved relative to the `auto-fix-issue` skill folder). Output: `BRANCH=`, then `STATUS=ok` or `STATUS=conflict` plus conflicted paths. Non-zero exit is a hard failure.
- `create_branch.sh` and `merge_main.sh` are being deleted (by scripter/node). No skill or doc may reference them afterwards.
- Resume: `branch_created` and `plan_located` both resume from Step 3. Step 1 always re-runs on resume, except for `pr_published`.

## Steps

- [01 — Reorder auto-fix-issue Steps 0–2](skill-writer/01-reorder-auto-fix-issue-steps.md)
- [02 — Update architecture docs](skill-writer/02-update-architecture-docs.md)

## Notes
- `discuss-issue` and `plan-issue` are deliberately **not** changed. They keep releasing to the safe branch before offering `/auto-fix-issue`.
- `auto-fix-all/steps/process_one_issue.md` already bootstraps before nesting. The second `checkout_from_main.sh` call is a no-op merge there, so no change is needed in that file.
