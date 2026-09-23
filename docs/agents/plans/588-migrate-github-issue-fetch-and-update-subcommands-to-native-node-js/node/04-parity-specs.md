# Parity specs

Add `core/spec/bin/githubIssueFetchParity_spec.js` and `core/spec/bin/githubIssueUpdateParity_spec.js`, modelled on `githubIssueCreateParity_spec.js`. Each runs `arcanum/_lib/github_issue_shell.sh fetch|update` directly (not via the shim, so the test is not circular) and `core/bin/arcanum github-issue-fetch|update` against identical inputs, asserting byte-identical stdout, stderr, and exit code. As in the existing parity specs, cover only the offline-reachable paths:

- `fetch`: nonexistent `repo_path`, a `repo_path` that is not a git repo, and a git repo with no `origin` remote.
- `update`: a missing `<file>`, both relative (resolved against `cwd`) and absolute; an existing file with a nonexistent `repo_path` / no `origin`, which reaches the origin error without a network call. Assert that a nonexistent `repo_path` with a **missing** file reports `file not found`, not a repo-path error. That proves `validateRepoPath: false` and the check order.

If the new specs would clone large blocks of `githubIssueCreateParity_spec.js` (`runCommand` / `runBoth`), extract the shared helpers into `core/spec/support/` and use them from all the github-issue parity specs, to keep `yarn duplication` clean.

## Files to Change
- `core/spec/bin/githubIssueFetchParity_spec.js` — new.
- `core/spec/bin/githubIssueUpdateParity_spec.js` — new.
- `core/spec/support/...` — optional shared parity helper, plus updates to the existing create/info parity specs if it is extracted.
