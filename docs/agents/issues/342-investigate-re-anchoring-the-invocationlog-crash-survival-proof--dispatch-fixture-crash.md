# Issue: Investigate re-anchoring the InvocationLog crash-survival proof (dispatch-fixture-crash)

## Description

Split off from #340 (investigate removing `dispatch-fixture` / `dispatch-fixture-crash`). That investigation concluded the shell↔native dispatch **parity** proof can likely drop `dispatch-fixture` in favor of one of the real, already-migrated `context: 'none'` commands (`auto-fix-all-config-*`, `arcanum-update-run-update-*`), following the existing real-command parity-test pattern in `core/spec/bin/autoFixAllConfigParity_spec.js`.

The `InvocationLog` **crash-survival** proof (`dispatch-fixture-crash`) is a separate concern: its entire job is to crash *deliberately and on demand*, per the explicit contract documented in `core/lib/core/commands.js`. No real, migrated command today offers a designed "crash on demand" contract — forcing one to crash via bad input would mean relying on accidental/undesigned error behavior (e.g. a malformed-input code path), which is brittle: a future hardening fix to that command's error handling could silently break the crash-survival test for a reason unrelated to `InvocationLog` at all.

`dispatch-fixture-crash` is exercised at two different layers:

- `core/spec/lib/core/dispatcher_spec.js`'s `InvocationLog recording` describe block (unit level, in-process).
- `core/spec/bin/arcanum_spec.js` (process level, spawns the real `bin/arcanum` binary as a subprocess).

Out of scope for #340 itself, which is now limited to the parity-proof rewiring and fixture-success-path removal. #340 has already been merged and closed, so #342 has no blocking dependency on it and can proceed immediately.

## Problem

The two crash-survival proofs don't need the same anchor, but today both depend on `dispatch-fixture-crash`:

- **Unit level** (`dispatcher_spec.js`): both tests dispatch through the real `dispatch-fixture-crash` registry entry, but neither actually needs to. `Dispatcher#dispatch()` only requires `COMMANDS[command]` to exist (to pass the "unknown command" guard) — the crash itself can come from spying `commandInstance()` to resolve a fake instance whose method rejects, instead of letting the real `DispatchFixture.crash()` run.
- **Process level** (`arcanum_spec.js`): this spawns the real `bin/arcanum` binary as a subprocess (black-box, no mocking seam), so it genuinely needs some command that crashes for real when invoked, to prove both "dispatch guard fails loud, no fallback" and "logging survives a crash" end-to-end. No real migrated command today has a *documented* synchronous-throw contract inside its own method body — `RepoContext#validate()`'s "repo_path is required" throw doesn't count, since it fires in the dispatcher itself before the command module is even imported (a different code path than the "module imported, then crashes" case the `commands.js` comment calls out). This layer looks intrinsically fixture-shaped.

## Expected Behavior

- `dispatcher_spec.js`'s `InvocationLog recording` describe block no longer constructs a crash via the real `dispatch-fixture-crash` registry entry or `DispatchFixture.js` — it anchors on an already-registered real `context: 'none'` command name and simulates the crash entirely with a mock.
- `arcanum_spec.js` is unchanged — `DispatchFixture.js`/`dispatch-fixture-crash` stay in place to back its process-level crash-survival proof, since that layer has no mocking seam and genuinely needs a real crash.
- The `commands.js` comment on the `dispatch-fixture-crash` entry and a new comment in `dispatcher_spec.js` document this split, so the unit-level dependency isn't accidentally reintroduced later.

## Solution

**Decision**: split the two proof layers. `dispatcher_spec.js`'s crash-survival tests get rewritten to no longer depend on `dispatch-fixture-crash`; `DispatchFixture.js`/`dispatch-fixture-crash` survive solely to back `arcanum_spec.js`'s process-level proof. Full retirement of the fixture is not pursued under this issue.

### Unit-level rewrite (`dispatcher_spec.js`)

`Dispatcher#commandInstance()` and `entryMethod()` are plain registry lookups — they don't require the module to actually crash. Both tests in the `InvocationLog recording` describe block get rewritten to:

- Use `'auto-fix-all-config-get'` as the anchor command name instead of `'dispatch-fixture-crash'` — already used elsewhere in this same spec file's `context: 'none' path` describe block, so this removes the last reference to `dispatch-fixture-crash` from `dispatcher_spec.js` entirely.
- Spy on `commandInstance()` to return a fully synthetic fake instance whose `entryMethod()`-named method throws, with no call-through to the real module:

  ```js
  spyOn(dispatcher, 'commandInstance').and.callFake(async () => {
    events.push('command-instance');
    return { [dispatcher.entryMethod()]: () => { throw new Error('simulated crash'); } };
  });
  ```

- Test 1 ("awaits record() before importing the command module") keeps its ordering assertion (`record-start` → `record-end` → `command-instance`) via `fakeInvocationLog`.
- Test 2 ("records a crashing command before it crashes") keeps its `invocationLog.record` was-called assertion via a jasmine spy.

### Scope of follow-through

The plan docs cited in existing comments (`docs/agents/plans/244-add-logs-to-native-nodejs-calls/node.md`, `docs/agents/plans/340-investigate-removing-dispatch-fixture---dispatch-fixture-crash/plan.md`) aren't actually in the repo (no git history for them), so there's nothing there to update. In-repo follow-through is limited to comments:

- `core/lib/core/commands.js`: extend the existing comment on the `dispatch-fixture-crash` entry to note it now backs `arcanum_spec.js`'s process-level proof only, and that `dispatcher_spec.js`'s unit-level crash-survival tests were decoupled from it (citing #342), so the dependency isn't re-added later.
- `core/spec/lib/core/dispatcher_spec.js`: add a brief comment on the rewritten tests explaining why `auto-fix-all-config-get` + a mocked `commandInstance()` stands in for a real crash (citing #342).
- No changes needed to `DispatchFixture.js` (its docstring is already framed entirely around `bin/arcanum`'s process-level dispatch guard, never mentions `dispatcher_spec.js`) or `docs/agents/architecture/script-engine.md` (no references to the removed unit-level dependency).

## Benefits

- Removes `dispatcher_spec.js`'s dependency on a deliberately-crashing fixture, making the unit-level crash-survival proof robust to any future change in how `DispatchFixture.js` simulates a crash.
- Documents, via code comments, that `dispatch-fixture-crash`'s remaining reason to exist is `arcanum_spec.js`'s process-level proof specifically — preventing the unit-level dependency from being silently reintroduced later.
