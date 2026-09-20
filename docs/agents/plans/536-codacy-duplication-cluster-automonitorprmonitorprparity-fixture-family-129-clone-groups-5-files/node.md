# Node Plan: Codacy: duplication cluster — autoMonitorPrMonitorPrParity fixture family (129 clone groups, 5 files)

Main plan: [plan.md](plan.md)

## Overview
Four of the five `autoMonitorPrMonitorPrParity` spec files share one exact boilerplate block: build a scenario via `setupParityTest({ ghVars, fetchVars })`, call `runPair(...)`, assert the same four `expect`s, then `cleanup()` in a `finally`. Only `ghVars`/`fetchVars`, an optional `issueId`, and the expected stdout string actually differ between test cases. `commented_spec.js` already extracted this locally as `expectCommentedParity`/`setupCommentScenario`; the goal here is to promote that shape into a single shared helper the whole family (minus `usage_error_spec.js`, which has a structurally different fixture/assertion shape and stays untouched) can call directly.

## Context
Codacy reports 129 clone groups / ~275 duplicated lines across this folder. See the issue for the full analysis of why `usage_error_spec.js` is excluded and why the fix is a shared assertion helper on the existing setup factory rather than a new `prStateParitySetup`-style factory file.

## Implementation Steps

### Step 1 — Add the shared `itMatchesShellForState` helper
In `core/spec/support/factories/autoMonitorPrMonitorPrParitySetup.js`, add an exported helper that wraps the duplicated block as a single Jasmine `it()`:

```js
/**
 * Registers an `it()` that builds a parity scenario via `setupParityTest`,
 * runs both sides via `runPair`, and asserts byte-identical stdout/exit
 * code plus the scenario's expected stdout. Replaces the
 * `setupParityTest` → `runPair` → 4-`expect`s → `cleanup` block
 * previously re-authored per spec file.
 * @param {string} description - the `it()` description.
 * @param {object} scenario - the scenario.
 * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides, for the shell side.
 * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides, for the native side.
 * @param {string} [scenario.issueId] - the `--issue-id` value, omitted for the legacy per-PR-file shape.
 * @param {string} scenario.expectedStdout - the expected shared stdout value.
 * @param {number} [scenario.timeout] - Jasmine's per-spec timeout override, when the scenario needs longer than the default (e.g. lock-contention scenarios).
 * @returns {void}
 */
export function itMatchesShellForState(description, { ghVars, fetchVars, issueId, expectedStdout, timeout } = {}) {
  it(description, async () => {
    const ctx = await setupParityTest({ ghVars, fetchVars });

    try {
      const { shell, native } = await runPair(ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv, issueId);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(expectedStdout);
    } finally {
      await ctx.cleanup();
    }
  }, timeout);
}
```

Place it below the existing `runPair` export, since it depends on both `setupParityTest` and `runPair` already defined in the same file.

### Step 2 — Migrate all four spec files onto the helper
Replace each duplicated block with a call to `itMatchesShellForState`, importing it alongside the existing `setupParityTest`/`runPair`/`OWNER` imports (drop `setupParityTest`/`runPair` from the import list in files where nothing else in the file still calls them directly):

- `terminal_states_spec.js` — 4 cases (merged, closed, approved-by-review, approved-review-superseded); keep the two review-JSON scenarios' shell/native fixture-building inline before each `itMatchesShellForState` call, same as today.
- `pending_spec.js` — 2 cases (nothing new, transient gh/API error).
- `shipit_spec.js` — 2 cases (`:shipit:`, `:shipit:` with surrounding whitespace).
- `commented_spec.js` — 2 cases (`--issue-id` shape, legacy shape); drop the file's local `expectCommentedParity` and inline the `try`/`finally`+`ctx.cleanup()` wrapping from `setupCommentScenario` — call `setupParityTest` directly, or keep `setupCommentScenario()` solely as a small ghVars/fetchVars-building convenience if that reads better, then pass its `{ ghVars, fetchVars }` output into `itMatchesShellForState`. Preserve `ISSUE_ID_SCENARIO_TIMEOUT_MS` by passing it as `scenario.timeout` only on the `--issue-id` case (the legacy-shape case keeps the default timeout, as today).

Every case keeps its existing description string, `ghVars`/`fetchVars` values, and expected stdout — this step only removes the repeated block, it does not change scenario behavior.

## Files to Change
- `core/spec/support/factories/autoMonitorPrMonitorPrParitySetup.js` — add the `itMatchesShellForState` helper (Step 1).
- `core/spec/bin/autoMonitorPrMonitorPrParity/terminal_states_spec.js` — migrate its 4 cases (Step 2).
- `core/spec/bin/autoMonitorPrMonitorPrParity/pending_spec.js` — migrate its 2 cases (Step 2).
- `core/spec/bin/autoMonitorPrMonitorPrParity/shipit_spec.js` — migrate its 2 cases (Step 2).
- `core/spec/bin/autoMonitorPrMonitorPrParity/commented_spec.js` — migrate its 2 cases, dropping the now-redundant local `expectCommentedParity` helper (Step 2).

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking) — expected to show the Codacy clone-group count for this folder drop after the fix

## Notes
- `usage_error_spec.js` is deliberately left untouched — it never calls `setupParityTest`/`runPair`, asserts exit code `1` with two distinct per-side `stderr` strings, and doesn't fit `itMatchesShellForState`'s shape.
- All five specs (including `usage_error_spec.js`, unchanged) must keep passing with unchanged coverage after this refactor, per the issue's acceptance criteria.
