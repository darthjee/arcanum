# Node Plan: Investigate re-anchoring the InvocationLog crash-survival proof (dispatch-fixture-crash)

Main plan: [plan.md](plan.md)

## Overview

`core/spec/lib/core/dispatcher_spec.js`'s `InvocationLog recording` describe block currently dispatches through the real `dispatch-fixture-crash` registry entry (`DispatchFixture.js`'s `crash()` method) to prove `InvocationLog#record()` is awaited before the command module is invoked, and survives a crash. `Dispatcher#commandInstance()`/`entryMethod()` are plain registry lookups that don't require the module to actually crash, so both tests can be rewritten to anchor on an already-registered real `context: 'none'` command (`auto-fix-all-config-get`, already used elsewhere in this spec file) with a mocked `commandInstance()` that returns a synthetic instance whose method throws — no dependency on `DispatchFixture.js` at all.

`core/spec/bin/arcanum_spec.js` spawns the real `bin/arcanum` binary as a subprocess (black-box, no mocking seam) and genuinely needs a real crash, so it and `DispatchFixture.js`/the `dispatch-fixture-crash` registry entry in `commands.js` stay as-is — only the entry's comment gets extended to document the new split.

## Context

From the issue: no real, migrated command today has a documented synchronous-throw contract inside its own method body (as opposed to `RepoContext#validate()`'s "repo_path is required" throw, which fires in the dispatcher before the command module is even imported — a different code path). That makes the process-level proof intrinsically fixture-shaped, but the unit-level proof has a mocking seam the process-level one lacks, so only the unit-level tests are re-anchored.

## Implementation Steps

### Step 1 — Rewrite `dispatcher_spec.js`'s `InvocationLog recording` tests

In `core/spec/lib/core/dispatcher_spec.js`, rewrite both tests in the `InvocationLog recording` describe block (currently around lines 139-168):

- Replace `new Dispatcher('dispatch-fixture-crash', [], ...)` with `new Dispatcher('auto-fix-all-config-get', [], ...)` in both tests.
- In the first test (`'awaits record() before importing the command module'`), replace the `spyOn(dispatcher, 'commandInstance').and.callFake(...)` implementation: drop the `original()` call-through entirely and instead resolve a fully synthetic fake instance whose `entryMethod()`-named method throws:

  ```js
  spyOn(dispatcher, 'commandInstance').and.callFake(async () => {
    events.push('command-instance');
    return { [dispatcher.entryMethod()]: () => { throw new Error('simulated crash'); } };
  });
  ```

  Keep the rest of the test (the `fakeInvocationLog` events array, the `await expectAsync(dispatcher.dispatch()).toBeRejected()` call, and the ordering assertion `['record-start:auto-fix-all-config-get', 'record-end:auto-fix-all-config-get', 'command-instance']`, updating the event strings' command name to match) unchanged.
- In the second test (`'records a crashing command before it crashes'`), which currently dispatches through the real `dispatch-fixture-crash` entry with no `commandInstance()` spy at all, add the same `spyOn(dispatcher, 'commandInstance')` stub (no call-through, no ordering events needed here — just enough to make `dispatch()` reject without touching `DispatchFixture.js`). Keep the `invocationLog.record` was-called-with-`'auto-fix-all-config-get'` assertion.
- Add a short comment above the describe block (or above each spy) noting that `auto-fix-all-config-get` + a mocked `commandInstance()` stand in for a real crash, so this unit-level proof no longer depends on `dispatch-fixture-crash`/`DispatchFixture.js` (citing #342) — see issue's "Scope of follow-through".

### Step 2 — Extend the `commands.js` comment on `dispatch-fixture-crash`

In `core/lib/core/commands.js`, extend the existing comment directly above the `'dispatch-fixture-crash'` entry (currently ~lines 177-183) to note that this entry now backs `core/spec/bin/arcanum_spec.js`'s process-level crash-survival proof only, and that `dispatcher_spec.js`'s unit-level crash-survival tests were decoupled from it (citing #342) — so the unit-level dependency isn't reintroduced later.

No changes to `DispatchFixture.js` (its docstring is already framed entirely around `bin/arcanum`'s process-level dispatch guard, never mentions `dispatcher_spec.js`) or `docs/agents/architecture/script-engine.md` (no references to the removed unit-level dependency).

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — rewrite both `InvocationLog recording` tests to anchor on `auto-fix-all-config-get` with a mocked `commandInstance()`, and add a comment explaining the substitution.
- `core/lib/core/commands.js` — extend the comment on the `dispatch-fixture-crash` entry to document the new split.

## CI Checks

- `core`: `yarn test` (CI job: `test`)

## Notes

- `core/spec/bin/arcanum_spec.js` and `core/lib/commands/shared/DispatchFixture.js` are intentionally left unchanged — the process-level proof keeps relying on a real crash, since a subprocess black-box test has no mocking seam.
- After the rewrite, `dispatch-fixture-crash` should have zero remaining references inside `dispatcher_spec.js` — worth a final grep to confirm before considering this issue done.
