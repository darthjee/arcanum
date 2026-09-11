# Parity test

Add a shell-vs-native parity spec, following `autoFixIssueCommitChangeParity_spec.js`'s shape: run `create_branch_shell.sh` directly (never through the `create_branch.sh` engine_dispatch shim, to keep the test non-circular) and `core/bin/arcanum auto-fix-issue-create-branch <plan_dir> <id>` against equivalent fixture-repo/plan-dir inputs, asserting byte-identical stdout (the branch name) and exit code on both sides.

Cases to cover, using `createGitFixtureRepo`/`createTempDir` test helpers under `core/spec/support/`:
- Target branch already exists locally in the fixture repo → both sides check it out and print the same name.
- Target branch doesn't exist yet → both sides create it and print the same name.
- No `plan.md` in the given plan dir → both sides fall back to `issue-<id>` and print the same name.

## Files to Change
- `core/spec/bin/autoFixIssueCreateBranchParity_spec.js` — new file, per the above.
