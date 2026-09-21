# Issue: Codacy: duplication cluster — DispatchFailure rejection-assertion boilerplate across spec suite (17 files, 30 occurrences)

## Context

Codacy flagged a duplication cluster (58 clone groups, ~90 duplicated lines) across five specs, originally described as a shared "label/tag mutation assertion" block. Refinement found that framing doesn't match the code — two of the five originally-listed files (`AutoFixAllConfig_spec.js`, `AutoFixAllQueuePop_spec.js`) contain no label-related code at all. The block genuinely duplicated across all five originally-flagged files (and project-wide) is a "reject with a DispatchFailure" assertion:

```js
let thrown;
try {
  await <call>;
} catch (error) {
  thrown = error;
}

expect(thrown).toBeInstanceOf(DispatchFailure);
expect(thrown.stdout).toEqual('');
expect(thrown.exitCode).toEqual(1);
```

This block is duplicated in 17 spec files (30 occurrences total) across `core/spec/`, not just the five files Codacy's cluster named:

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js`
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues_spec.js`
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js` (block appears twice internally)
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueRunChecks_spec.js`
- `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js` (4 occurrences; currently wraps the try/catch half in a private, file-local `captureRejection(promise)` helper but still repeats the trailing assertion trio inline)
- `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js`
- `core/spec/lib/utils/issue/IssueTaggerLabelOperations_spec.js`
- `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js`

Out of scope: `AutoFixAllConfig_spec.js` also separately repeats an unrelated "acquires and releases the lock file" block, shared with three other files elsewhere — a different duplication cluster, deliberately left for a possible separate issue.

## What needs to be done

- Add a shared-example function under `core/spec/support/sharedExamples/` — matching the convention already established by `cliParityValidation.js`, `engineDispatchRouting.js`, `githubIssueCreateSharedExamples.js`, and `issueStateWriteSharedExamples.js` from the four just-merged sibling duplication fixes (#538-#541) — that takes the caller's invocation plus the expected `stdout`/`exitCode`, awaits/catches the rejection, and asserts `toBeInstanceOf(DispatchFailure)` with those values.
- Update all 17 files listed above (30 call sites, including the two internal repeats in `AutoFixAllConfig_spec.js`) to use the shared example instead of hand-rolling the try/catch + assertion block.
- Retire the private `captureRejection` helper in `DiscussIssueConfirm_spec.js` in favor of the shared example.

## Acceptance criteria

- [ ] A shared example for asserting a `DispatchFailure` rejection (stdout/exitCode) exists under `core/spec/support/sharedExamples/` and is used by all 17 listed specs (30 call sites).
- [ ] No spec file hand-rolls the try/catch + `toBeInstanceOf(DispatchFailure)`/`stdout`/`exitCode` block inline anymore, including the two internal repeats in `AutoFixAllConfig_spec.js` and the private `captureRejection` helper in `DiscussIssueConfirm_spec.js`.
- [ ] All 17 specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this cluster drops substantially after the fix lands.
