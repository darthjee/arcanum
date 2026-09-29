# Run auto-fix-issue nested from auto-fix-all

In `auto-fix-all/steps/process_one_issue.md` §4 ("Implement and open/mark-ready the PR"), use the same wording as §2/§3 use for `auto-new-issue` / `auto-plan-issue`:

- Read `../../auto-fix-issue/steps/run.md` and follow it for `<id>`, carrying `REPO_PATH` forward unchanged, **with `NESTED=true`**. The nested run ends by returning a `FINISH_*` block instead of a report. Do not relay or merge it, since `auto-fix-all` keeps its own `OUTCOME=...` protocol (link to "Nested runs" in `docs/agents/specs/skill-finish.md`).
- If the block has `FINISH_STATUS=failed`: stop processing this issue and report `OUTCOME=blocked AGENT=architect ACTION="<FINISH_SUMMARY>"` at the top level, as §3 already does. Do not continue to §5.
- Otherwise, take the PR number from `FINISH_PR` (replacing "Record the issue's title and the PR URL/number it reports"). The title still comes from the issue file.

Check that nothing else in `auto-fix-all` reads free-form text printed by `auto-fix-issue`, e.g. `grep -rn auto-fix-issue auto-fix-all/`.

## Files to Change
- `auto-fix-all/steps/process_one_issue.md` — §4 runs `auto-fix-issue` with `NESTED=true` and handles the `FINISH_*` block.
