# Pass NESTED=true from auto-fix-all
In `auto-fix-all/steps/process_one_issue.md` section `## 3. Create the plan`, mirror how `## 2. Create the issue file` already runs `auto-new-issue`:

- follow `auto-plan-issue/steps/run.md` for `<id>`, carrying `REPO_PATH` forward unchanged, **with `NESTED=true`**;
- the nested run ends by returning a `FINISH_*` block instead of a report; do not relay or merge it, since `auto-fix-all` keeps its own `OUTCOME=...` protocol (link "Nested runs" in `docs/agents/specs/skill-finish.md`);
- if the block has `FINISH_STATUS=failed`, treat it as the plan step failing and handle it the way this file already handles a failed step (do not continue to the `fetched` → `working` swap or Step 4). Check the file for its existing failure convention and reuse it rather than inventing a new one.

Leave the existing "do not commit them again here" note and the tag-swap block as they are.

## Files to Change
- `auto-fix-all/steps/process_one_issue.md` — section 3: `NESTED=true`, block handling, failed-status handling.
