# Issue: Codacy: Lizard nloc-medium — core/spec/lib/core/commands_spec.js (1 finding)

## Description

Codacy (Lizard, pattern `Lizard_nloc-medium`, category Complexity, severity **Warning**) flags one anonymous function in `core/spec/lib/core/commands_spec.js` with 69 lines of code (limit 50):

- `core/spec/lib/core/commands_spec.js:8` — the `it('sets context: \'repo\' on the migrated arcanum-split-issue, … and spawn-issue entries', …)` callback.

The callback is long because it inlines a hard-coded array of ~64 command names expected to carry `context: 'repo'`. Its test description also lists every command family, and that list is already out of date with the array.

## Problem

- The hard-coded expected list makes the `it` callback go over Lizard's 50-line limit.
- The long description repeats the array and goes stale every time a command is migrated.

## Expected Behavior

- Codacy reports zero `Lizard_nloc-medium` findings for `core/spec/lib/core/commands_spec.js`.
- The spec still asserts exactly the same ordered set of `context: 'repo'` commands (`toEqual` on the filtered keys), so coverage is unchanged.
- `yarn test` and `yarn lint` under `core/` pass.

## Solution

- Move the expected `context: 'repo'` command-name array out of the `it` callback into a module-level `const` (e.g. `REPO_CONTEXT_COMMANDS`) at the top of `commands_spec.js`.
- The `it` body becomes the filter plus a single `expect(withRepoContext).toEqual(REPO_CONTEXT_COMMANDS)`.
- Shorten the description to e.g. `"sets context: 'repo' on the expected entries"`.
- Only the flagged test changes. Other tests in the file stay as they are.

Owner: `node` agent.

## Benefits

- Clears a Codacy Complexity warning.
- The expected list is easier to find and edit, and the test description no longer goes stale.
