# gh parity cases

Add `itWithGh` parity cases under `core/spec/docker/`, using the step-02 helpers. Each runs the shim's real `engine_dispatch` call, natively and in `PARITY_IMAGE`, and compares stdout, stderr, exit code and file changes:

- **Read-only:** `github-issue-fetch`, `github-issue-info`, `resolve-and-fetch` (file written in the repo), `auto-fix-all-github-has-label` (also `has-shipit-label`), `auto-fix-all-github-pr-number`, `auto-fix-all-github-pr-state`, `auto-fix-issue-github-pr-view`, `auto-monitor-issue-pr-resolve-pr-number`, `auto-fix-all-queue-push`, `auto-fix-all-queue-save`. Use the fixture issue, PR and branch.
- **Label mutations,** restored between runs and at the end: `auto-fix-all-github-add-tag`, `auto-fix-all-github-remove-tag`, `monitor-issues-github-remove-tag`, `github-issue-mark-created`, `-enhancing`, `-planning`, `-ready`, `-refined`, `-split`. Compare output, and also check that the fixture issue's resulting label set matches across the two runs.

One read-only command per shim family also runs from a git worktree (`{ worktree: true }`). If output includes timestamps or other volatile values, normalize them the same way in both runs. Don't loosen the comparison.

The 12 commands without a parity case (see the issue) get no spec here. Scripter records why in the checklist notes.

## Files to Change

- `core/spec/docker/sharedLib_spec.js`: github-issue fetch/info/mark-*, resolve-and-fetch.
- `core/spec/docker/autoFixAllQueue_spec.js`: queue push/save.
- `core/spec/docker/autoFixAllGithub_spec.js` (new): has-label, pr-number, pr-state, add/remove-tag.
- `core/spec/docker/autoFixIssue_spec.js`: pr-view.
- `core/spec/docker/autoMonitorIssuePr_spec.js` (new): resolve-pr-number.
- `core/spec/docker/monitorIssues_spec.js`: github remove-tag.
