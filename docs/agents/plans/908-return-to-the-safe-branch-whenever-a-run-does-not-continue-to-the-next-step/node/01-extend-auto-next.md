# Extend AutoPlanIssueAutoNext

Rework `run(id)` per the shared contract: validate → branch check (`REASON=branch`) → `promptFlags` → push always (`REASON=push` on failure) → `markReady` → if `auto`, return `CHAIN=yes\n[CLEAR=true\n]READY=<b>\n`, else `releaseToSafeBranch` and return `CHAIN=no\nREASON=config\nREADY=<b>\nRELEASED=<b>\n`. Add the two new constructor deps (`githubIssueMark`, `safeBranch`) and small private helpers (`markReady`, `release`) that never throw and report a boolean. Update the class JSDoc.

## Files to Change
- `core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js` — new flow, deps, helpers, JSDoc.
