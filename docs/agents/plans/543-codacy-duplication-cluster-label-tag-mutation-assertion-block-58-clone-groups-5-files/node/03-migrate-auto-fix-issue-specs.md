# Migrate auto-fix-issue command specs

Same mechanical change as step 02, applied to the three `auto-fix-issue` command specs: import `captureRejection` and replace each inline `let thrown; try {...} catch (error) { thrown = error; }` block with `const thrown = await captureRejection(<call>);`, leaving the following assertions untouched.

- `AutoFixIssueGithubPrView_spec.js` has one occurrence (around lines 32-42).
- `AutoFixIssueMergeMain_spec.js` and `AutoFixIssueRunChecks_spec.js` — verify their exact occurrence(s)/line numbers against current `main` before editing (the issue's original line citations were for a different, mismatched pattern).

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js` — replace the try/catch block with `captureRejection`.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueRunChecks_spec.js` — replace both try/catch blocks with `captureRejection`.
