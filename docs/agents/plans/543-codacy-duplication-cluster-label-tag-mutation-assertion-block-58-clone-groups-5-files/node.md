# Node Plan: Codacy: duplication cluster — DispatchFailure rejection-assertion boilerplate across spec suite (17 files, 30 occurrences)

Main plan: [plan.md](plan.md)

## Context

The originally-filed issue framed this cluster as a "label/tag mutation assertion block," but that doesn't match the code — two of the five files Codacy named (`AutoFixAllConfig_spec.js`, `AutoFixAllQueuePop_spec.js`) have no label-related content at all. Deeper investigation while refining the issue found the real duplicated fragment is the rejection-capture idiom used to test `DispatchFailure` errors:

```js
let thrown;

try {
  await someCall();
} catch (error) {
  thrown = error;
}
```

This shape recurs 30 times across 17 spec files (confirmed by `grep -rc "toBeInstanceOf(DispatchFailure)" core/spec`, minus one unrelated hit in `DispatchFailure_spec.js` itself, which tests the error class's own constructor and isn't part of this duplication).

**Important nuance found during exploration**: the assertions that follow the capture are *not* uniform. Most files assert `expect(thrown).toBeInstanceOf(DispatchFailure)` plus `thrown.exitCode`/`thrown.stdout` against `1`/`''`, but:
- `AutoFixAllCheckoutFromMain_spec.js` asserts `exitCode` only (`2`), no `stdout` equality (stdout is checked separately via `toContain`).
- `ArcanumUpdateRunUpdateApply_spec.js`/`ArcanumUpdateRunUpdateCheck_spec.js`/`ArcanumSplitIssuePushSubIssues_spec.js`/`ArcanumSplitIssueCreateSubIssue_spec.js` assert non-empty, scenario-specific `stdout` strings and, in one case, a non-1 `exitCode` (`3`).
- `SpawnIssueRetry_spec.js` follows the capture with spy call-count assertions instead of/in addition to `stdout`.
- `IssueTaggerLabelOperations_spec.js` uses the *same* capture shape but a **negative** assertion (`expect(thrown).not.toBeInstanceOf(DispatchFailure)`) — it's testing a plain `Error`, not a `DispatchFailure`.

Because of this variance, a single matcher/shared-example wrapping the *assertions* (as the issue's original `haveAppliedLabels`-style framing implied) would force mismatched shapes onto files that don't share them. The capture idiom itself, however, is byte-identical everywhere. So the fix extracts only that shared piece — matching the precedent already set locally by `DiscussIssueConfirm_spec.js`, which already has a private, file-scoped `captureRejection(promise)` helper doing exactly this. This plan promotes that helper to `core/spec/support/utils/`, alongside the sibling `captureStdout.js` utility, and retires the private copy.

## Steps

- [01 — Add the shared captureRejection utility](node/01-add-capture-rejection-utility.md)
- [02 — Migrate auto-fix-all command specs](node/02-migrate-auto-fix-all-specs.md)
- [03 — Migrate auto-fix-issue command specs](node/03-migrate-auto-fix-issue-specs.md)
- [04 — Migrate arcanum-split-issue and arcanum-update command specs](node/04-migrate-arcanum-command-specs.md)
- [05 — Migrate discuss-issue, shared, and issue-utils specs](node/05-migrate-remaining-specs.md)

## Files to Change

- `core/spec/support/utils/captureRejection.js` — new shared utility (step 01)
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain_spec.js`, `AutoFixAllConfig_spec.js`, `AutoFixAllGithubLabels_spec.js`, `AutoFixAllQueuePop_spec.js`, `AutoFixAllQueuePush_spec.js`, `AutoFixAllQueueSave_spec.js` (step 02)
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`, `AutoFixIssueMergeMain_spec.js`, `AutoFixIssueRunChecks_spec.js` (step 03)
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js`, `ArcanumSplitIssuePushSubIssues_spec.js`, `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`, `ArcanumUpdateRunUpdateCheck_spec.js` (step 04)
- `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js`, `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js`, `core/spec/lib/utils/issue/IssueTaggerLabelOperations_spec.js`, `IssueTaggerMarkEnqueued_spec.js` (step 05)

## CI Checks

- `core`: `yarn test` (CI job: `test`, runs `c8 jasmine`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking — use it locally to confirm the cluster is gone)

## Notes

- Do not force the trailing assertions (`stdout`/`exitCode`/spy calls/negative checks) into the shared utility — only the capture idiom is genuinely identical across all 17 files. Each spec keeps its own `expect(thrown)...` lines afterward, unchanged in substance, just no longer preceded by a hand-rolled `let thrown; try {...} catch {...}`.
- `IssueTaggerLabelOperations_spec.js`'s occurrence tests a plain `Error` (not a `DispatchFailure`) — still migrate its capture to the shared utility for consistency, but do not alter its negative assertion.
- The separate "acquires and releases the lock file" duplication in `AutoFixAllConfig_spec.js` is out of scope per the issue — do not touch it here.
- `DiscussIssueConfirm_spec.js` currently defines its own private `captureRejection(promise)` (lines ~10-18) — delete it and import the shared one instead of keeping both.
