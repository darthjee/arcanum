# Issue: Codacy: duplication cluster — autoFixAllReplyCommentParity trio internal duplication (3 files)

## Description
Three specs in `core/spec/bin/autoFixAllReplyCommentParity/` — `preconditions_spec.js`, `rest_failure_spec.js`, and `happy_path_spec.js` — duplicate the fixture lifecycle used to compare the shell (`auto-fix-all/scripts/reply_comment_shell.sh`) and native (`core/bin/arcanum auto-fix-all-reply-comment`) implementations of the same entrypoint: creating a fake `gh` binary, two git fixture repos, seeding them as GitHub-like, running both implementations, asserting parity, and cleaning up in a `finally` block.

Codacy reports duplication scores as high as 480 for `preconditions_spec.js` alone, with roughly 90 duplicated lines shared across the trio — concretely, `preconditions_spec.js` lines 85-112 (the "no pull request found" case) map onto `rest_failure_spec.js` lines 17-53 and `happy_path_spec.js` lines 18-49 almost verbatim.

This mirrors the already-fixed sibling cluster from issue #536 (`autoMonitorPrMonitorPrParity` fixture family), where an `itMatchesShellForState` helper absorbed the same kind of shell/native fixture-lifecycle duplication.

## Problem
The three cases differ in exactly three places, and the shared helper needs to accommodate all of them:
- extra environment variables per case (e.g. `FAKE_GH_PR_NUMBER`, `FAKE_GH_COMMENT_FAIL`, `ARCANUM_TEST_FAKE_FETCH`) — absent in the "no pull request found" case, present with different values in the REST-failure and happy-path cases;
- whether the native command needs the `--import` fake-fetch preload flag (only the REST-failure and happy-path cases touch the native `fetch` call);
- the final parity assertions, which differ per case (empty stdout vs. specific stdout content, non-zero exit vs. exit 0).

A helper that only wraps "REST stub + assertion" (as literally proposed) would miss the `preconditions_spec.js` case, which shares the same fixture setup/teardown but isn't a REST scenario at all.

## Solution
Following the precedent set by issue #536, extract a shared fixture helper into `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js` (where this family's other shared setup already lives) that wraps the common lifecycle — fake `gh` binary, two git fixture repos, seeding, running shell vs. native, cleanup — parameterized over the three points of variation above (extra env, native `--import` flag, final assertions). Replace the duplicated blocks in all three spec files with calls to this helper.

## Acceptance Criteria
- [ ] A shared fixture helper exists in `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js` and is used by `preconditions_spec.js`, `rest_failure_spec.js`, and `happy_path_spec.js`.
- [ ] The duplicated fixture-lifecycle blocks are removed from each file in favor of the shared helper.
- [ ] All three specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this folder drops substantially after the fix lands.
