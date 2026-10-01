# Reorder auto-fix-issue Steps 0–2

Edit `auto-fix-issue/steps/run.md` so the branch is checked out before the issue and plan are resolved:

1. **New Step 1 — Bootstrap the branch.** Parse the id (accept `5` or `#5`). Run `../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` (resolved relative to the `auto-fix-issue` skill folder).
   - `STATUS=conflict`: reuse the conflict-handling paragraph currently under Step 2's `merge_main.sh` (responsible-agent selection per `auto-fix-all/steps/handle_comment.md`, then `git -C "$REPO_PATH" add` / `commit` with no message).
   - Non-zero exit, or a conflict that cannot be resolved: **fail with** `checkout_from_main.sh`, with `--issue <id>` (and `--nested` when `NESTED=true`), naming the conflicted paths when there are any. If no numeric id can be parsed, fail the same way without `--issue`.
   - On success, record `step branch_created`.
2. **New Step 2 — Locate the issue and plan.** This is the old Step 1 body (`resolve_plan_paths.sh`, the `PLAN_EXISTS=false` failure, reading the files), minus id parsing. Record `step plan_located`.
3. **Delete the old Step 2** entirely, including the `## Branch` / `create_branch.sh` / `merge_main.sh` text.
4. **Step 0 resume table:** both `branch_created` and `plan_located` resume from Step 3. State that, except for `pr_published`, Step 1 always re-runs on resume (idempotent) before jumping ahead, and that Step 2's paths are re-resolved when needed by later steps.
5. **Intro paragraph (line 5):** replace "Step 2's `create_branch.sh`" with Step 1's `checkout_from_main.sh` in the list of `REPO_PATH`-threaded calls.

Also check the other `auto-fix-issue/steps/*.md` files and `auto-fix-issue/SKILL.md` for references to the old step numbers or scripts, and update any you find.

## Files to Change
- `auto-fix-issue/steps/run.md` — new Step 1 bootstrap, Step 2 locate, old Step 2 removed, resume table and intro updated.
