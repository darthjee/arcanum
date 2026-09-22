# Plan: Codacy: duplication cluster — InvocationLog_spec.js internal self-duplication (13 clone groups, 1 file)

Issue: [552-codacy-duplication-cluster-invocationlog-spec-js-internal-self-duplication-13-clone-groups-1-file.md](../../issues/552-codacy-duplication-cluster-invocationlog-spec-js-internal-self-duplication-13-clone-groups-1-file.md)

## Overview

`core/spec/lib/utils/logging/InvocationLog_spec.js` repeats the same `execFileSpy`/`appendFileSpy`/`InvocationLog` construction across 5 of its 6 tests, varying only the stubbed return values and `env`. This plan extracts that construction into a shared spec helper — following the precedent set by `core/spec/support/utils/execCallTracker.js` (added for #550) — and updates each test to call it with only the overrides it needs.

## Context

- `core/spec/lib/utils/logging/InvocationLog_spec.js` (114 lines) has 6 `it` blocks under `describe('#record')`.
- 5 of them build `execFileSpy = jasmine.createSpy('execFileAsync')...`, `appendFileSpy = jasmine.createSpy('appendFileAsync')...`, and `new InvocationLog({ execFileAsync, appendFileAsync, configChainPath: CONFIG_CHAIN_PATH, env })`, roughly at lines 8-17, 29-36, 45-52, 60-67, 74-83, and 89-98 — near-identical blocks that only differ in the spies' stubbed return values and the `env` object passed in.
- `core/spec/support/utils/execCallTracker.js` (added in #550's fix) is the existing precedent for factoring a jasmine-spy builder out of a spec file into `core/spec/support/utils/`.
- No existing helper builds an `InvocationLog` instance with its spies today — this plan adds one, scoped to `core/spec/support/utils/logging/`.

## Implementation Steps

### Step 1 — Add a shared InvocationLog test-harness helper

- Create `core/spec/support/utils/logging/invocationLogHarness.js`, exporting a builder (e.g. `buildInvocationLog(overrides = {})`) that:
  - Creates `execFileSpy` (`jasmine.createSpy('execFileAsync')`) and `appendFileSpy` (`jasmine.createSpy('appendFileAsync')`), each defaulting to the common resolved values used by most tests (`execFileSpy` resolving `{ stdout: '"/var/log/arcanum"\n', stderr: '' }`, `appendFileSpy` resolving `undefined`), overridable via `overrides.execFileAsync`/`overrides.appendFileAsync` (either a fully custom spy or a fake return value) for the tests that need different behavior (empty stdout, rejection, no-`env`).
  - Constructs `new InvocationLog({ execFileAsync: execFileSpy, appendFileAsync: appendFileSpy, configChainPath: CONFIG_CHAIN_PATH, env: overrides.env ?? { ARCANUM_REPO_PATH: '/repo/my-repo' } })`.
  - Returns `{ invocationLog, execFileSpy, appendFileSpy }` so tests can assert on the spies afterward.
  - `CONFIG_CHAIN_PATH` moves into this helper module (it's only ever the fixed `/fake/arcanum/_lib/config_chain.sh` constant used by every test) and is exported alongside the builder for the one test that asserts on it directly (`args.slice(-2)` in the "passes repoPath/configChainPath" test).
- Follow `execCallTracker.js`'s existing JSDoc style for the new export.

### Step 2 — Refactor InvocationLog_spec.js to use the helper

- Replace each of the 6 tests' inline `execFileSpy`/`appendFileSpy`/`new InvocationLog(...)` construction with a call to `buildInvocationLog(...)`, passing only the overrides each test actually needs:
  - Test 1 (`resolves the location and appends...`) and test 6 (`passes repoPath/configChainPath...`) use the defaults as-is.
  - Test 2 (`no-ops when ARCANUM_REPO_PATH is absent`) overrides `env: {}`.
  - Test 3 (`no-ops when execFileAsync resolves with an empty/unset location`) overrides `execFileAsync` to resolve `{ stdout: '\n', stderr: '' }`.
  - Test 4 (`swallows silently when execFileAsync rejects`) overrides `execFileAsync` to reject.
  - Test 5 (`swallows silently when appendFileAsync rejects`) overrides `appendFileAsync` to reject.
- Remove the now-unused local `CONFIG_CHAIN_PATH` constant from the spec file, importing it from the new helper instead where still referenced.
- Keep every existing assertion (`expect(...)`) unchanged — only the setup portion of each test changes.

## Files to Change

- `core/spec/support/utils/logging/invocationLogHarness.js` — new shared builder for `InvocationLog` + its spies.
- `core/spec/lib/utils/logging/InvocationLog_spec.js` — replace duplicated construction in all 6 tests with calls to the new helper.

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- No production code (`core/lib/utils/logging/InvocationLog.js`) changes — this is spec-only deduplication.
- Coverage must remain unchanged after the refactor (per the issue's acceptance criteria) — the same branches/assertions are exercised, just via shared setup.
