# Codacy: duplication cluster — autoFixAllQueueParity sibling specs (push/save/pop/empty/list/next/wait-next) (7 files)

## Description
Codacy reports ~30 clone groups / ~70 duplicated lines across the `auto-fix-all-queue-*` shell-vs-native parity specs in `core/spec/bin/autoFixAllQueueParity/`: `push_spec.js`, `save_spec.js`, `pop_spec.js`, `empty_spec.js`, `list_spec.js`, `next_spec.js` and `wait_next_spec.js`. Every test re-authors the same scaffold: build fixtures, `seedQueue` both sides, `runPair`, `expectParity`, assert exit code and stdout, tear down.

## Problem
The family uses two fixture flavours, each copy-pasted per test:

- **Git + fake `gh` flavour** (`push`, `save`): `setupParityTest()` → optional `seedQueue` on both repos → build an env with `PATH=<fakeGh.binDir>:$PATH` plus `FAKE_GH_*`/`FAKE_FETCH_*` vars → `runPair(op, …, { env, fakeFetch })` → `expectParity` + code/stdout asserts → `ctx.cleanup()`. `push_spec.js` repeats this three times internally and shares an 8–10 line block verbatim with `save_spec.js`.
- **Plain temp-dir flavour** (`pop`, `empty`, `list`, `next`, `wait-next`): two `createTempDir` calls → `seedQueue` both sides → `runPair(op, …, [])` → `expectParity` + code/stdout asserts → `removeTempDir` both. Only the op, seed ids, expected code and expected stdout differ between tests.

A few tests also run a follow-up op (`push` → `list`, `pop` → `next`) and check its stdout on both sides.

The originally proposed `itMatchesShellForQueueOp(op, seedState)` signature is too narrow for this: it cannot express args, env/fake-fetch options, the expected code/stdout, or the follow-up check.

## Expected Behavior
- Each parity spec declares its cases as data (op, seed, args, env/fake-fetch options, expected exit code and stdout, and an optional follow-up op with its expected stdout) and does not re-author the fixture/run/assert/cleanup scaffold.
- Test names, the cases covered, the assertions, and the network isolation (fake `gh` / fake `fetch`) stay the same.

## Solution
- Add a shared example to `core/spec/support/sharedExamples/` as `queueParitySharedExamples.js` (following the repo's shared-example convention), built on the existing `core/spec/support/factories/queueParitySetup.js` helpers (`setupParityTest`, `seedQueue`, `runPair`). It exposes a case-driven helper, for example `itMatchesShellForQueueOp(description, { op, seed, args, env, fakeFetch, github, expectedCode, expectedStdout, followUp })`:
  - `github: true` uses `setupParityTest()` and prepends `fakeGh.binDir` to `PATH`; otherwise it uses a pair of plain temp dirs.
  - `seed` (optional) is passed to `seedQueue` on both sides; when omitted, no queue file is written (covers `next`'s absent-file case).
  - `expectedCode` accepts an exact number or a "non-zero" marker (covers the no-ids rejection cases).
  - `followUp: { op, expectedStdout }` runs a second `runPair` and asserts both sides.
  - Cleanup always runs in `finally`.
- Rewrite the seven parity spec files as thin lists of `itMatchesShellForQueueOp(...)` calls. Keep each file's header comment explaining the parity contract.
- `queueParitySetup.js` may gain a small fixture-pair helper for the temp-dir flavour if that keeps the shared example simple.

### Acceptance criteria
- [ ] A shared queue-parity example exists under `core/spec/support/sharedExamples/` and every spec in `core/spec/bin/autoFixAllQueueParity/` uses it.
- [ ] The run/assert/cleanup scaffold, including `push_spec.js`'s internal repetition, is gone from the individual specs.
- [ ] Test names, scenarios and assertions are unchanged, and the specs pass.
- [ ] Codacy duplication for this family drops substantially.

## Benefits
- Removes ~30 Codacy clone groups.
- A new queue op or scenario can be added as one data entry instead of a copied block.
