# Move the per-issue steps into auto-resolve-issue

`git mv` these two files into the new skill folder, keeping their names:

- `auto-fix-all/steps/process_one_issue.md` → `auto-resolve-issue/steps/process_one_issue.md`
- `auto-fix-all/steps/handle_comment.md` → `auto-resolve-issue/steps/handle_comment.md`

Then fix the references inside them so they still resolve from the new location:

- Every `scripts/<name>.sh` call already carries a note like "Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder". Keep those notes. They remain true and are now load-bearing, since `scripts/` is no longer next to the step. Make sure **every** script call in both files has such a note, including `checkout_from_main.sh`, `cleanup_artifacts.sh`, `wait_ci.sh`, `wait_ci_and_merge.sh`, and `reply_comment.sh` in `handle_comment.md`. Where a note says "relative to this skill folder" or is implicit, make it say `auto-fix-all` explicitly.
- `handle_comment.md`'s mention of the reply template: it lives at `auto-fix-all/templates/reply.tmpl.md` and is read by `reply_comment.sh`. Reword any mention that implies it sits next to the step.
- Relative links to other skills (`../../auto-new-issue/steps/run.md`, `../../auto-plan-issue/steps/run.md`, `../../auto-fix-issue/steps/run.md`, `../../auto-monitor-issue-pr/steps/run.md`, `../../auto-fix-issue/scripts/commit_change.sh`, `../../docs/agents/...`) stay valid at the same depth. Double-check each one.
- `../auto-plan-issue/scripts/resolve_plan_paths.sh` mentions (in the approval paths) are resolved relative to the `auto-plan-issue` skill folder. Keep that wording.
- Links between the two moved files (`[handle_comment.md](handle_comment.md)`, `[process_one_issue.md](process_one_issue.md)`) stay valid.
- Reword prose that names the owning skill: "for the `auto-fix-all` pipeline" → "for the per-issue pipeline (run by `auto-resolve-issue`, and by `auto-fix-all` for each queued issue)". "the coordinator that spawned you" stays generic, since either coordinator may be the spawner.
- In the `pending` branch, keep "The coordinator that spawned you owns rescheduling".
- The pipeline-signalling tag notes ("this is `auto-fix-all`-specific pipeline signaling") become "per-issue pipeline signaling". The rationale for keeping them out of `auto-new-issue`/`auto-plan-issue` stays.

## Files to Change
- `auto-fix-all/steps/process_one_issue.md` → `auto-resolve-issue/steps/process_one_issue.md` — moved; script-resolution notes and prose updated
- `auto-fix-all/steps/handle_comment.md` → `auto-resolve-issue/steps/handle_comment.md` — moved; script/template resolution notes updated
