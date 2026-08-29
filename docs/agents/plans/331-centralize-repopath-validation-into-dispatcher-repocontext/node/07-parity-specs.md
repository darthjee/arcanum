# Re-verify and extend the shell-parity specs

The validation error is now raised from the dispatch layer, before the command
module loads. Every `context: 'repo'` migrated entrypoint's parity spec in
`core/spec/bin/*Parity_spec.js` must still pass unchanged — run the full suite
(`make core-test`) and confirm.

Then add a missing/non-dir/non-git `repo_path` case to the parity specs that only
exercise valid git fixtures today, so the newly-uniform behaviour is locked in.
Each parity spec already runs the `*_shell.sh` script directly and the native
`core/bin/arcanum` against identical fixtures, asserting byte-identical stdout /
stderr / exit code (see `listAgentsParity_spec.js:175-210` for the shape to
copy — "a missing repo_path" and "a non-git repo_path" describe blocks).

Priority — the 5 newly-strict surfaces (verify shell + native now match on a
non-dir / non-git path; the shell side already calls `repo_path_enter`):

- `core/spec/bin/autoFixAllGithubParity/` — all 7 subcommands.
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js`
- `core/spec/bin/resolveAndFetchParity_spec.js`
- `core/spec/bin/resolveIdAndFileParity_spec.js`
- `core/spec/bin/resolvePlanPathsParity_spec.js`

Also add the non-dir / non-git case where absent, to the specs for the 13
already-validating entrypoints (`arcanumSplitIssue*Parity_spec.js`,
`autoFixAllCheckoutFromMainParity_spec.js`,
`autoFixAllCleanupArtifactsParity_spec.js`, `autoFixAllWaitCi*Parity_spec.js`,
`checkoutSafeBranchParity_spec.js`, `githubIssueCreateParity_spec.js`,
`issueStateParity_spec.js`, `listAgentsParity_spec.js` (already has it),
`spawnIssueParity_spec.js`).

Do NOT touch `githubIssueInfoParity_spec.js` — its `Origin`-style message
(`Error: '<p>' is not a git repository or has no 'origin' remote`) is the
exempted contract (step 02) and must keep passing as-is.

Leave the absent-leading-arg parity cases exactly as they are — that behaviour is
#333's; step 03's `&& this.args[0]` guard keeps them green.

## Files to Change

- `core/spec/bin/autoFixAllGithubParity/` — add non-dir / non-git `repo_path`
  cases for the 7 subcommands.
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` — add the case.
- `core/spec/bin/resolveAndFetchParity_spec.js` — add the case.
- `core/spec/bin/resolveIdAndFileParity_spec.js` — add the case.
- `core/spec/bin/resolvePlanPathsParity_spec.js` — add the case.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` — add the case
  if absent.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` — same.
- `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` — same.
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js` — same.
- `core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` — same.
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js` — same.
- `core/spec/bin/autoFixAllWaitCiParity_spec.js` — same.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` — same.
- `core/spec/bin/checkoutSafeBranchParity_spec.js` — same.
- `core/spec/bin/githubIssueCreateParity_spec.js` — same.
- `core/spec/bin/issueStateParity_spec.js` — same.
- `core/spec/bin/spawnIssueParity_spec.js` — same.
