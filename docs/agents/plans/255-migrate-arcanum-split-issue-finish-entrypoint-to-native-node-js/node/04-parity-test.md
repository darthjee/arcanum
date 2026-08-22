# Shell/native parity test

Write `core/spec/bin/arcanumSplitIssueFinishParity_spec.js`, following `core/spec/bin/spawnIssueParity_spec.js`'s structure: run `arcanum-split-issue/scripts/finish_shell.sh` (directly — NOT through the `finish.sh` `engine_dispatch` shim, to avoid circularity) and `core/bin/arcanum arcanum-split-issue-finish` against identical inputs/repo state, asserting byte-identical stdout and exit code.

Scope this test to the offline-reachable, deterministic paths only, per the repo-wide "no real network calls in specs" rule (`mark-split` needs a real `gh`/GitHub call, so the success path can't run here):
- Missing `<repo_path>`/`<issue_id>` argument → identical usage-error stderr/exit code between both.
- Invalid `repoPath` (not a directory, or not a git repo — use `core/spec/support/utils/gitFixtureRepo.js`'s `createGitFixtureRepo` helper where useful) → identical error/exit code between both.

Use a real temp dir (`createTempDir`/`removeTempDir`) with a `docs/agents/issues/` fixture for any case that reaches the file-listing logic without needing `mark-split` to succeed — e.g. confirm both implementations fail identically at the same point when `github.sh mark-split` itself would need real network access unavailable in CI (both should produce the same non-zero exit code and no `Deleted:`/`BRANCH=` stdout, since `mark-split` runs before the cleanup step in both implementations).

Cross-reference this file and `docs/agents/plans/255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js/plan.md`'s "Shared contracts" in a header comment, mirroring `spawnIssueParity_spec.js`'s own header.

## Files to Change

- `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` — new file.
