# Shell/native parity test

Follow the precedent under `core/spec/bin/autoFixAllWaitCiParity` and `core/spec/support/factories/autoFixAllWaitCiParitySetup.js` (the closest existing polling-script migration, per the issue file's own note) and `core/spec/bin/autoMonitorIssuePrResolvePrNumberParity` (the closest sibling in this same `auto-monitor-*` family) for the harness shape: both the shell script and `core/bin/arcanum auto-monitor-pr-monitor-pr` are invoked as real subprocesses against a mocked/stubbed `gh`, and stdout + exit code are asserted identical.

## Files to Change

- `core/spec/support/factories/autoMonitorPrMonitorPrParitySetup.js` (new) — build the fixture repo checkout, a stub `gh` executable on `PATH` that serves canned `gh pr view --json state,comments,reviews` / `gh api repos/.../pulls/.../comments` / `gh api graphql` responses (mirroring whatever stubbing mechanism `autoFixAllWaitCiParitySetup.js` already uses for `gh api .../check-runs`), and seeds `.claude/state/` fixtures for both state-file shapes.
- `core/spec/bin/autoMonitorPrMonitorPrParity` (new) — the parity spec itself, covering at minimum: merged, closed, approved-by-review, approved-by-shipit, one-new-comment (both state-file shapes), and pending-on-gh-error — run once with `engine.mode=shell` and once with `engine.mode=native`, asserting byte-identical stdout and exit code for each scenario.

## Notes

- Given the number of distinct `gh` invocations this script makes (view, two API calls, GraphQL mutations), the stub `gh` needs to dispatch on its arguments rather than return one fixed response — check whether `autoFixAllWaitCiParitySetup.js`'s stub already supports argument-based dispatch or only single-response stubbing, and extend it (or add a sibling helper) rather than duplicating a whole new stubbing mechanism from scratch.
- Confirm `arcanum/_lib/engine_dispatch.sh` actually routes `auto-monitor-pr-monitor-pr` correctly for both `engine.mode=native` and `engine.mode=shell` once `migration-status.json` is flipped (per the issue file's Step 7) — this is naturally exercised by the parity test itself running both modes, so no separate manual check should be needed beyond that test passing.
