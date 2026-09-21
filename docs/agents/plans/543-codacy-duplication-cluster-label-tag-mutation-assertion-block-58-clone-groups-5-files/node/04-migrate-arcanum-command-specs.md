# Migrate arcanum-split-issue and arcanum-update command specs

Same mechanical change as step 02, applied to the `arcanum-split-issue` and `arcanum-update` command specs. These files have some of the more elaborate follow-up assertions (long dynamic `stdout` strings, a non-1 `exitCode` in one case) — migrate only the capture, keep every `expect(...)` line below it exactly as written.

- `ArcanumSplitIssueCreateSubIssue_spec.js` — one occurrence (around lines 195-206); note the comment explaining the `STATUS=failed` double-appearance stays attached to its assertion, unchanged.
- `ArcanumSplitIssuePushSubIssues_spec.js` — three occurrences (around lines 175-185, 190-198, 215-226).
- `ArcanumUpdateRunUpdateApply_spec.js` — two occurrences (around lines 60-66, 74-80); one asserts `exitCode: 3`, the other `exitCode: 1` with a `STATUS=missing_arcanum` stdout — leave both assertion sets untouched.
- `ArcanumUpdateRunUpdateCheck_spec.js` — two occurrences (around lines 80-87, 93-100).

## Files to Change

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues_spec.js` — replace all three try/catch blocks with `captureRejection`.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js` — replace both try/catch blocks with `captureRejection`.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateCheck_spec.js` — replace both try/catch blocks with `captureRejection`.
