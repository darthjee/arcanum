# Parity and regression specs
Add a detached-HEAD case to each shell/native parity spec, using the existing `createGitFixtureRepo` and the spec's own `runCommand` helpers. Detach with `git checkout --detach` in the fixture, record `git rev-parse HEAD`, `git status --porcelain` and the remote's refs (`git -C <remotePath> for-each-ref`) before the run. Then assert, for both engines:
- the same non-zero exit code and empty stdout;
- stderr carries the refusal message, compared under the spec's existing stderr convention;
- HEAD, `git status --porcelain` (index and working tree) and the remote refs are unchanged.

Specs:
- `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`
- `core/spec/bin/autoNewIssueCommitIssueParity_spec.js`
- `core/spec/bin/autoFixIssueCommitChangeParity_spec.js`
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js` (include the "nothing to clean up" variant)
- `core/spec/bin/autoFixAllReplyCommentParity/` (new `detached_head_spec.js`; also assert no comment was posted, via the spec's existing `gh`/REST stub)
- `core/spec/bin/autoMonitorPrMonitorPrParity/` (new `detached_head_spec.js`): both engines succeed with identical output and the remote refs are unchanged.

Regression test for the incident, in `autoPlanIssueCommitPlanParity_spec.js` (or a new `autoPlanIssueCommitPlanDetachedHeadRegression_spec.js` if it reads better): in the fixture, commit once on local `main` without pushing (local `main` ahead of `origin/main`), then `git checkout --detach origin/main`, write a plan dir and run `commit_plan` on both engines. Assert that the remote's `refs/heads/main` is unchanged, that local `main` is unchanged, and that no new commit exists.

## Files to Change
- `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`: detached-HEAD case and regression case.
- `core/spec/bin/autoNewIssueCommitIssueParity_spec.js`: detached-HEAD case.
- `core/spec/bin/autoFixIssueCommitChangeParity_spec.js`: detached-HEAD case.
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js`: detached-HEAD cases.
- `core/spec/bin/autoFixAllReplyCommentParity/detached_head_spec.js`: new.
- `core/spec/bin/autoMonitorPrMonitorPrParity/detached_head_spec.js`: new.
