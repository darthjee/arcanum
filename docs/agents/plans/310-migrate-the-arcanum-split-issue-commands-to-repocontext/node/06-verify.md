# Dispatcher/registry assertions and full verification

Tie off the registry-level test coverage and confirm the whole change is
output-neutral.

## What to do

1. `core/spec/lib/core/dispatcher_spec.js` — the flag-on path is already
   covered generically via `dispatch-fixture-repo-context` (construct with a
   `RepoContext` from `args[0]`, strip the leading arg). Confirm that coverage
   still holds; only add a case if the existing tests are fixture-name-specific
   in a way that no longer represents the real registry (they should not be —
   `dispatcher_spec.js` drives its own throwaway entries). No production change
   here.

2. Grep the repo for any remaining `.run(<repoPath>, …)` / `new
   ArcanumSplitIssue*(` call sites outside the four specs and
   `ArcanumSplitIssuePushSubIssues` (which is handled in step 05). Expected:
   none — `core/bin/arcanum` goes through `Dispatcher`, and the
   `arcanum-split-issue/scripts/*.sh` shims pass `repoPath` positionally for
   the `Dispatcher` to consume. Verify each shim's `engine_dispatch "$REPO_PATH"
   <command> … -- "$@"` line still lines up; no edit expected.

3. Confirm the four `core/spec/bin/arcanumSplitIssue*Parity_spec.js` files are
   **unmodified** and passing:
   - `arcanumSplitIssueCreateSubIssueParity_spec.js`
   - `arcanumSplitIssueCreateSubIssueFileParity_spec.js`
   - `arcanumSplitIssueFinishParity_spec.js`
   - `arcanumSplitIssuePushSubIssuesParity_spec.js`

4. From `core/`, run `yarn test` and `yarn lint`. Both must be green. Pay
   attention to `eslint-plugin-jsdoc` — every touched constructor/method JSDoc
   must match the new signatures (no stale `@param repoPath`).

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — only if the existing flag-on coverage no longer reflects the real registry (unlikely; verify).
- (verification only) `core/spec/bin/arcanumSplitIssue*Parity_spec.js` — must stay byte-for-byte unchanged.
