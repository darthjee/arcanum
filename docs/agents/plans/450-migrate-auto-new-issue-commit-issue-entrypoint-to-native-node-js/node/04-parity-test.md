# Write the shell/native parity test

Create `core/spec/bin/autoNewIssueCommitIssueParity_spec.js`, following
`core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`'s structure closely:

- Run `auto-new-issue/scripts/commit_issue_shell.sh` directly (NOT through the
  `auto-new-issue/scripts/commit_issue.sh` `engine_dispatch` shim, to avoid a
  circular test) against `core/bin/arcanum auto-new-issue-commit-issue`, with
  equivalent inputs/fixture-repo state, asserting byte-identical stdout and
  exit code for:
  - The success path (commits and pushes a real file in a git fixture repo
    built via `createGitFixtureRepo`, from `core/spec/support/utils/gitFixtureRepo.js`).
  - Missing-argument usage errors.
  - `file_path` pointing at a nonexistent file.
- Reuse `createTempDir`/`removeTempDir` for scratch fixture directories and
  normalize the non-deterministic abbreviated commit hash out of `git
  commit`'s stdout before comparison (same helper/approach as the
  `auto-plan-issue-commit-plan` parity spec).
- This spec only exercises real behavior once
  `auto-new-issue/scripts/commit_issue_shell.sh` exists (see
  [scripter.md](../scripter.md)) — write the spec against the plan's shared
  contract now, but confirm it actually passes only after that file lands.

## Files to Change

- `core/spec/bin/autoNewIssueCommitIssueParity_spec.js` — new parity test
  comparing `commit_issue_shell.sh` and the native `arcanum
  auto-new-issue-commit-issue` entrypoint.
