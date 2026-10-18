# Harden the {agent} replaceAll calls

Switch `String(value).replaceAll('{agent}', AGENT)` (or `agent`) to a replacer
function (`replaceAll('{agent}', () => AGENT)`) so that no variable value is used as
a replacement *string* in `core/lib`. Agent names are low risk; this is for
consistency.

## Files to Change

- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` — line ~206.
- `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` — line ~206.
- `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — line ~225 (`agent` is a parameter here, so it's the most relevant of the three).
