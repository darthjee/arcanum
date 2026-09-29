# Commit and publish the confirmed plan

## What to change

In `plan-issue/steps/write_and_confirm.md`, replace the `## Offer to open the PR` section with a `## Commit and publish the plan` section. It is reached once the user confirms the plan, for both a freshly written plan and `PLAN_EXISTS=true`. Mirror `discuss-issue/steps/discuss_and_save.md` §8 (`CHOICE=yes`, steps 1, 2, 4, 5 and 6), using the same wording conventions: always `git -C "$REPO_PATH"`, never bare git.

1. **Bootstrap the branch.** Run `../../auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>`.
   - Non-zero exit: **fail with** `checkout_from_main.sh`.
   - `STATUS=conflict`: resolve it the way `discuss-issue` §8 step 1 does, using the responsible-agent selection in `auto-fix-all/steps/handle_comment.md`. Then run `git -C "$REPO_PATH" add` and `git -C "$REPO_PATH" commit`. If the conflict cannot be resolved, **fail with** `checkout_from_main.sh (merge conflict)`.
   - The plan files (and the issue file, if untracked) were written to the working tree before the checkout and carry over as untracked files.
2. **Commit the issue file if needed.** If `git -C "$REPO_PATH" ls-files --error-unmatch <ISSUE_FILE>` shows it is not tracked on the branch, run `../../auto-new-issue/scripts/commit_issue.sh "$REPO_PATH" <ISSUE_FILE> <id> "<your AI model name>" "<your AI model noreply email>"`. On failure, **fail with** `commit_issue.sh`.
3. **Commit the plan.** Run `../../auto-plan-issue/scripts/commit_plan.sh "$REPO_PATH" <PLAN_DIR> <id> "<your AI model name>" "<your AI model noreply email>"`. It stages, commits and pushes. Never commit by hand.
   - If `git -C "$REPO_PATH" status --porcelain -- <PLAN_DIR>` shows nothing pending (the plan was already committed), skip this call.
   - On failure, **fail with** `commit_plan.sh`.
4. **Push.** Run `git -C "$REPO_PATH" push` so any already-committed but unpushed plan and issue commits are published. On failure, **fail with** `plan push`.
5. **Swap labels.** Run `../../discuss-issue/scripts/github.sh mark-ready "$REPO_PATH" <id>`. This is best-effort: on failure, omit `refined:ready` from the report and do not fail the skill.
6. **Release the working tree.** Run `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"`.

## Files to Change
- `plan-issue/steps/write_and_confirm.md`: replace "Offer to open the PR" with "Commit and publish the plan".
