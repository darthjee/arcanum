# Add Dispatcher / commands specs and verify the suite

New unit coverage for `Dispatcher` and the extracted registry, plus a full
suite + lint run.

## What to do

1. Create `core/spec/lib/core/dispatcher_spec.js` (jasmine; picked up by the
   `lib/**/*_spec.js` glob). Cover:
   - **flag-off path** (via a real entry, e.g. `dispatch-fixture`):
     `commandInstance()` returns `new ModuleClass()` (no `RepoContext` argument);
     `commandArgs()` returns `args` unchanged; `dispatch()` returns the method's
     result; the `repoContext` getter is never triggered (assert e.g. via a spy
     on `RepoContext` or by passing args whose `[0]` would blow up if used).
   - **flag-on path** (via the `dispatch-fixture-repo-context` entry from step 01):
     `commandInstance()` returns `new ModuleClass(repoContext)` where
     `repoContext instanceof RepoContext` and `repoContext.repoPath === args[0]`;
     `commandArgs()` returns `args.slice(1)`; `dispatch()`'s string result
     reflects the stripped args and the `repoPath`.
   - **lazy + memoized `repoContext`**: two reads of the getter return the same
     instance; not constructed until the flag-on path needs it.
   - **`InvocationLog` recording**: inject a fake `invocationLog` with a
     `record` spy — assert `record(command)` is awaited **before** the dynamic
     `import()` resolves the module (e.g. spy ordering, or a fake whose `record`
     resolves after a tick and a module whose construction records a marker);
     assert `record` is **not** called when `entry.log === false`.
   - **unknown command**: `new Dispatcher('not-a-real-command', []).dispatch()`
     rejects with an `Error` whose message contains `not-a-real-command`.
2. Optionally add `core/spec/lib/core/commands_spec.js` asserting the registry
   shape: `COMMANDS` is a non-empty object; no **real** entry sets
   `takesRepoContext` (only `dispatch-fixture-repo-context` does); `dispatch-fixture`
   keeps `log: false`. Fold into `dispatcher_spec.js` if a separate file feels
   heavy.
3. Run from `core/`:
   - `yarn lint` — clean (JSDoc, indent, quotes, `eqeqeq`).
   - `yarn test` — full suite green, including the untouched
     `core/spec/bin/arcanum_spec.js` and every `*Parity_spec.js`.

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — **new**; flag-off / flag-on / lazy
  memoization / logging-order / unknown-command coverage.
- `core/spec/lib/core/commands_spec.js` — **new** (optional); registry-shape
  assertions.
