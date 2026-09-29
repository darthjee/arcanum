# Pass NESTED=true from auto-fix-all

In `auto-fix-all/steps/process_one_issue.md` §2 ("Create the issue file"), change the hand-off to read: follow `auto-new-issue/steps/run.md` for `<id>`, carrying `REPO_PATH` forward unchanged, **with `NESTED=true`**. Add one sentence saying the nested run ends by returning a `FINISH_*` block, which `auto-fix-all` does not relay or merge. It keeps its own `OUTCOME=...` protocol, per the spec's "Nested runs" section. Leave §3's `auto-plan-issue` hand-off untouched (#665).

## Files to Change
- `auto-fix-all/steps/process_one_issue.md` — §2 hand-off passes `NESTED=true`.
