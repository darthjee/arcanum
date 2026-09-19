## Description

Codacy's PMD tool flags 71 "Avoid Unnecessary Blocks" findings (28 files) under `core/spec/support/` — ECMAScript blocks (`{ }`) that don't introduce a new scope and can mislead readers into thinking they do.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is one of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/bin`, `core/spec/lib`, `core/lib/commands`, `core/lib/utils`, and the small remainder in `core/lib/services`+`core/lib/context`+`core/lib/core`.

## Affected files (count in parentheses)

`factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js` (4), `factories/arcanumSplitIssueCreateSubIssueParitySetup.js` (4), `factories/arcanumSplitIssuePushSubIssuesParitySetup.js` (4), `factories/arcanumUpdateRunUpdate.js` (3), `factories/arcanumUpdateRunUpdateParitySetup.js` (4), `factories/autoFixAllCheckoutFromMainParitySetup.js` (5), `factories/autoFixAllConfigParitySetup.js` (4), `factories/autoFixAllGithub.js` (3), `factories/autoFixAllQueue.js` (1), `factories/autoFixAllReplyComment.js` (4), `factories/autoFixAllReplyCommentParitySetup.js` (3), `factories/autoFixAllWaitCi.js` (5), `factories/autoFixIssueGithub.js` (1), `factories/autoFixIssueGithubParitySetup.js` (1), `factories/autoMonitorIssuePrResolvePrNumberParitySetup.js` (2), `factories/autoMonitorPrMonitorPrParitySetup.js` (2), `factories/githubParitySetup.js` (1), `factories/issueStateParitySetup.js` (1), `factories/issueTagger.js` (2), `factories/prOperations.js` (2), `factories/queueParitySetup.js` (2), `factories/spawnIssue.js` (1), `fixtures/engineDispatchFixtures.js` (1), `utils/captureStdout.js` (1), `utils/fakeFetch.js` (3), `utils/fakeGhBin.js` (1), `utils/gitFixtureRepo.js` (1), `utils/runCommand.js` (5).

(All paths relative to `core/spec/support/`.)

## Expected Behavior

- Redundant `{ }` blocks in these 28 files are removed without changing test/fixture behavior (`yarn test` under `core/` still passes).
- Re-running PMD/Codacy across `core/spec/support/` shows zero `UnnecessaryBlock` findings.

## Solution

Same mechanical cleanup as the sibling clusters — check for an automated fix (lint autofix) before hand-editing, then confirm with a test run.

