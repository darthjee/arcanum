# Issue: Codacy: duplication cluster — autoMonitorPrMonitorPrParity fixture family (129 clone groups, 5 files)

## Description
Codacy flags heavy duplication across the "auto-monitor-pr-monitor-pr" parity spec family in `core/spec/bin/autoMonitorPrMonitorPrParity/`:

- `terminal_states_spec.js`
- `pending_spec.js`
- `shipit_spec.js`
- `commented_spec.js`
- `usage_error_spec.js`

Codacy reports 129 clone groups and roughly 275 duplicated lines across this family.

## Problem
Four of the five files (`terminal_states_spec.js`, `pending_spec.js`, `shipit_spec.js`, `commented_spec.js`) share the exact same per-test boilerplate: build a scenario via `setupParityTest({ ghVars, fetchVars })` (already shared, from `autoMonitorPrMonitorPrParitySetup.js`), then repeat:

```js
try {
  const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv[, issueId]);

  expect(native.stdout).toEqual(shell.stdout);
  expect(native.code).toEqual(shell.code);
  expect(shell.code).toEqual(0);
  expect(shell.stdout).toEqual(<expected stdout>);
} finally {
  await ctx.cleanup();
}
```

only the `ghVars`/`fetchVars` fed into `setupParityTest`, the optional `issueId`, and the expected stdout string actually vary between cases. `commented_spec.js` already extracted this locally as its own `expectCommentedParity` helper — the remaining duplication is that the same shape is re-authored independently in the other three files instead of being shared across the family.

`usage_error_spec.js` does **not** share this shape: it never calls `setupParityTest`/`runPair`, builds plain fixture repos directly via `createGitFixtureRepo`, asserts exit code `1` (not `0`), and checks two *different* per-side `stderr` strings (`USAGE` for native vs. `USAGE_TAIL` for shell) rather than a single shared stdout value. It does not fit a `itMatchesShellForState`-style shared example.

The issue's originally proposed shape — a `prStateParitySetup(state)` factory "parallel to `queueParitySetup.js`" — doesn't quite match: scenario setup is already centralized in `setupParityTest`, so there's nothing left for a second setup factory to do. The actual duplicated code is the run+assert+cleanup block, which is closer to `queueParitySetup.js`'s own `runPair` in spirit than to a new setup factory.

## Solution
- Add a shared assertion helper (e.g. `itMatchesShellForState({ ghVars, fetchVars, issueId, expectedStdout })` or similar) to the existing `core/spec/support/factories/autoMonitorPrMonitorPrParitySetup.js`, covering the `setupParityTest` → `runPair` → four-`expect`s → `cleanup` shape shared today by `terminal_states_spec.js`, `pending_spec.js`, `shipit_spec.js`, and `commented_spec.js`.
- Update those four spec files to call the shared helper instead of re-authoring the block, folding `commented_spec.js`'s existing local `expectCommentedParity` into it (keeping its `ISSUE_ID_SCENARIO_TIMEOUT_MS` override as a per-call option).
- Leave `usage_error_spec.js` out of this refactor — its fixture/assert shape is structurally different (no parity-state fixture, distinct per-side stderr strings, exit code 1) and doesn't belong in the same shared example.

## Benefits
- Removes the run+assert+cleanup duplication Codacy flags across the four PR-state-parity specs.
- New PR-state scenarios only need to supply their distinguishing vars/expected stdout, not re-author the scaffold.
- Keeps `usage_error_spec.js` honest about testing a genuinely different code path instead of forcing it into a shape it doesn't fit.
