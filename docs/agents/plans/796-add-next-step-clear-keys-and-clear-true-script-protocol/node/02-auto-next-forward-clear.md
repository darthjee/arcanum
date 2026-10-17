# Forward CLEAR=true in AutoPlanIssueAutoNext

In `core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js`, make the prompt
check return both flags (e.g. `{ auto, clear }`, `clear` from a line equal to
`CLEAR=true`). After a successful push, return `CHAIN=yes\nCLEAR=true\n` when
`clear` is set, `CHAIN=yes\n` otherwise. `CHAIN=no` paths never add `CLEAR`. Update
the class JSDoc contract.

Specs in `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext_spec.js`:
clear on + push ok → `CHAIN=yes\nCLEAR=true\n`; clear on + push fails →
`CHAIN=no\nREASON=push\n`; clear on + wrong branch → `CHAIN=no\nREASON=branch\n`;
auto on, clear off → unchanged `CHAIN=yes\n`; the two-key notice passes through to
stderr.

## Files to Change
- `core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js` — parse and forward `CLEAR=true`.
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext_spec.js` — new cases.
