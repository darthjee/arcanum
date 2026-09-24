# Node Plan: Codacy: Lizard nloc-medium — core/spec/lib/core/commands_spec.js (1 finding)

Main plan: [plan.md](plan.md)

## Overview
The `it('sets context: \'repo\' on …')` callback at `core/spec/lib/core/commands_spec.js:8` has 69 lines of code, over Lizard's limit of 50, because it inlines a ~64-entry expected array. Move that array to module scope and shorten the description so the callback is only a few lines.

## Context
- Codacy / Lizard `Lizard_nloc-medium`, severity Warning, 1 finding at line 8.
- The test filters `Object.keys(COMMANDS)` for `context === 'repo'` and asserts `toEqual` on an ordered array. That assertion must stay exactly the same.
- Agreed scope: change only this test. The `validateRepoPath: false` test (line ~91) and all other tests stay as they are.
- Agreed placement: a module-level `const` in the same spec file, not a file under `core/spec/support/fixtures/`.

## Implementation Steps

### Step 1 — Extract the expected list to a module-level constant
In `core/spec/lib/core/commands_spec.js`, add `const REPO_CONTEXT_COMMANDS = [ … ];` between the `import` line and `describe('COMMANDS', …)`. It holds the same entries, in the same order, as the current inline array. Replace the inline array in the test with `expect(withRepoContext).toEqual(REPO_CONTEXT_COMMANDS);`.

### Step 2 — Shorten the test description
Rename the test to `it('sets context: \'repo\' on the expected entries', () => { … })`. The old description listed command families and was already stale.

## Files to Change
- `core/spec/lib/core/commands_spec.js` — hoist the expected `context: 'repo'` array to a module-level `REPO_CONTEXT_COMMANDS` constant and shorten the test description.

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- Keep the array contents and order unchanged. The spec is a regression guard on `COMMANDS` insertion order.
- No production code under `core/lib/` changes.
