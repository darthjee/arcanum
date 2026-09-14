# node Plan: Split fakeGhBin.js's buildGhScript method (173 LOC vs Lizard limit of 50)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Split `buildGhScript` into per-subcommand helpers

In `core/spec/support/utils/fakeGhBin.js`, extract five new private helper functions —
`buildAuthCase(authTokenAlwaysFails)`, `buildPrViewCase()`, `buildPrMutationCase()`,
`buildApiCase()`, `buildIssueCase()` — each returning the bash source for one top-level `gh`
subcommand's `case` branch, copied verbatim from the current `buildGhScript` body (same variable
names, same env var names/defaults, same error messages). Reduce `buildGhScript` itself to: the
shebang, `set -euo pipefail`, the `AUTH_TOKEN_ALWAYS_FAILS` line, the `_json_flag_value` helper
(keep it in `buildGhScript`'s own output, or move it into `buildPrViewCase()`'s returned string
since it's the only case that calls it — either is fine as long as it's defined before use in the
emitted script), the top-level `case "${1:-}"` dispatch that interpolates each helper's return
value into the corresponding branch, and the final "unrecognized invocation" fallback. Add/update
JSDoc on every new helper, matching the existing single-line-summary-plus-`@param`/`@returns`
style already used on `buildGhScript` and `createFakeGhBin`.

### Step 2 — Verify byte-for-byte behavior and complexity limits

Before committing, temporarily compare `buildGhScript(false)` and `buildGhScript(true)`'s
returned strings against the pre-refactor versions (e.g. checking out the old file to a scratch
location, requiring both, and diffing the two output strings for both boolean values) to confirm
the generated bash source is byte-for-byte unchanged. Then run `make core-test` and
`make core-lint` to confirm every existing spec that depends on `createFakeGhBin`/`fakeGhBin.js`
still passes unmodified. Manually confirm `buildGhScript` and each new helper is at or under 50
source lines (the repo's Lizard limit) by counting lines in the edited file, since there is no
local Lizard command in this repo (see Notes).

## Files to Change

- `core/spec/support/utils/fakeGhBin.js` — split `buildGhScript` into `buildAuthCase`,
  `buildPrViewCase`, `buildPrMutationCase`, `buildApiCase`, `buildIssueCase`, plus a reduced
  `buildGhScript` that assembles them; add JSDoc to each new helper; no change to
  `createFakeGhBin`'s signature or return shape.

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Lizard complexity enforcement runs via Codacy's cloud analysis on the PR, not a local script in
  this repo — there's no `make`/`yarn` target that reproduces it locally; manual line-counting is
  the closest local proxy.
- `_json_flag_value`'s exact placement (shared top-level helper vs. moved into
  `buildPrViewCase()`) is an implementation detail, as long as the emitted script still defines it
  before any call site that uses it.
- No new spec file is required for `fakeGhBin.js` itself — its behavior is already exercised
  transitively by the existing parity-spec suite, per the issue's acceptance criteria.
