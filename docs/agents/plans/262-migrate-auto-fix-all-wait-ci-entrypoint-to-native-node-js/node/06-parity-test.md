# Parity test

Write `core/spec/bin/autoFixAllWaitCiParity_spec.js` (naming convention shared with the five already-merged siblings, e.g. `autoFixAllCheckoutFromMainParity_spec.js`), asserting identical stdout and exit code between `wait_ci_shell.sh` and `core/bin/arcanum auto-fix-all-wait-ci` for the same inputs: a passing PR, a failing PR, and a PR with only ignored-pattern check-runs. Since this script polls forever with a 5s sleep until check-runs resolve, both this test and Step 05's unit tests must avoid a genuinely long-running/hanging run — fully mock/stub the `gh`/`fetch` responses so they resolve on the first poll (no real GitHub calls, no real 5s waits), per the issue's own note and `docs/agents/architecture/script-engine.md`'s "no real network calls in CI" rule.

Finish by verifying `arcanum/_lib/engine_dispatch.sh` routes correctly for both `engine.mode=native` and `engine.mode=shell` against the new shim from Step 01 (can be covered by this same parity spec, or a small dedicated case, whichever fits the existing sibling specs' shape).

## Files to Change

- `core/spec/bin/autoFixAllWaitCiParity_spec.js` — new file.
