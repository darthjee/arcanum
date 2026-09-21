# Migrate discuss-issue, shared, and issue-utils specs

Same mechanical change as step 02, applied to the remaining four files:

- `DiscussIssueConfirm_spec.js` — **delete its own private `captureRejection` definition (lines 4-18)** and import the shared one from step 01 instead; update its four call sites (around lines 60, 71, 81, 91) to use the shared import. This is the file the shared utility was modeled on, so its own call sites need no other change.
- `SpawnIssueRetry_spec.js` — three occurrences (around lines 25-31/32-38, 55-61/62-71, 85-93). Note the follow-up assertions here are spy call-count checks (`githubIssueService.create`, `deps.sleepFn`), not `stdout`/`exitCode` — leave them untouched.
- `IssueTaggerLabelOperations_spec.js` — one occurrence (around lines 62-68). This one asserts `.not.toBeInstanceOf(DispatchFailure)` (it's testing a plain `Error`, not a `DispatchFailure`) — migrate the capture only, keep the negative assertion as-is.
- `IssueTaggerMarkEnqueued_spec.js` — two occurrences (around lines 45-52, 60-67).

## Files to Change

- `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js` — remove the private `captureRejection` function, import the shared one, keep all four call sites otherwise unchanged.
- `core/spec/lib/commands/shared/SpawnIssueRetry_spec.js` — replace all three try/catch blocks with `captureRejection`.
- `core/spec/lib/utils/issue/IssueTaggerLabelOperations_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js` — replace both try/catch blocks with `captureRejection`.
