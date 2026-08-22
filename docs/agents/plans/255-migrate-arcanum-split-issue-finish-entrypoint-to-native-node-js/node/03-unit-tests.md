# Native unit tests

Write `core/spec/lib/ArcanumSplitIssueFinish_spec.js`, fully fake-injected (no real network/`gh`/filesystem side effects beyond a temp dir), following `core/spec/lib/SpawnIssue_spec.js`'s `stubDeps`/fake-`execFileAsync` conventions and `core/spec/support/utils/tempDir.js`'s `createTempDir`/`removeTempDir` helpers for the `docs/agents/issues/` cleanup assertions.

Cover:
- Missing `repoPath`/`issueId` → throws the exact usage-message `Error`.
- `repoPath` validation failure → propagates `RepoPath#validate`'s rejection uncaught.
- `github.sh mark-split` call: asserts it's invoked via the injected `execFileAsync` with `['mark-split', repoPath, issueId]` as an argument array (never a string command) and the correct script path.
- `github.sh mark-split` rejecting → the rejection propagates uncaught (no swallowed error, no `Deleted:`/`BRANCH=` output).
- File cleanup, using a real temp dir seeded with a mix of `<id>-*`, `<id>_*`, and unrelated files: asserts only the matching two prefixes are deleted, in `<id>-*` order then `<id>_*` order, and that the returned `Deleted:` block lists them in that same order with the `docs/agents/issues/<name>` relative-path shape.
- No matching files → returns `Deleted: (nothing to clean up)\n` (not an empty `Deleted:\n` block).
- Safe-branch release: asserts the injected `SafeBranch`-like fake's `checkout(repoPath)` is called (not `run`), and its resolved branch name is formatted as a trailing `BRANCH=<branch>\n` line.
- `SafeBranch#checkout` rejecting → propagates uncaught.
- Full success path: the resolved string is exactly the `Deleted:`/`Deleted: (nothing to clean up)` block immediately followed by `BRANCH=<branch>\n`, matching the shared-contract output shape.

## Files to Change

- `core/spec/lib/ArcanumSplitIssueFinish_spec.js` — new file.
