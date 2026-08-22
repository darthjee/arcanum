# Parity test

Write a shell-vs-native parity test asserting identical stdout and exit code for the same inputs, following the shape of `core/spec/bin/autoFixAllReplyCommentParity_spec.js` (see also `core/spec/support/utils/fakeGhBin.js` and `fakeGithubApiFetchPreload.js` for the pattern of stubbing `gh` and network calls so no real GitHub API calls happen in CI).

Create `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`:

- Runs `arcanum-split-issue/scripts/create_sub_issue_shell.sh` (scripter's renamed file — depends on [scripter's step 1](../scripter.md)) directly for the "shell" side, and `core/bin/arcanum arcanum-split-issue-create-sub-issue` for the "native" side, against the same fixture repo/sub-issue draft file/mocked `gh`+`fetch` responses.
- Asserts both produce byte-identical stdout (`STATUS=ok\nID=<id>\n` including the progress line) and exit code 0 on the success case.
- Asserts both produce byte-identical stdout (`STATUS=failed\n`) and exit code 1 on the retry-exhausted failure case (mock the fixture's `gh`/`fetch` stub to always fail issue creation).
- Uses a fixture repo tree under `core/spec/support/fixtures/` for the sub-issue draft file and `.claude/state/issue-<id>.json`, per this project's "no real network calls in CI" convention.

## Files to Change

- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` — new parity test.
