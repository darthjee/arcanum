# Create dispatcherInvocationLog_spec.js

New file `core/spec/lib/core/dispatcherInvocationLog_spec.js` holding the
`InvocationLog recording` `describe` from the original, verbatim, under a single top-level
wrapper `describe('Dispatcher (InvocationLog recording)', () => { … })`:

- 2 `it`s: `awaits record() before importing the command module` (ordering proof via
  `fakeInvocationLog`); `records a crashing command before it crashes` (via a
  `jasmine.createSpy` logger).
- Move the multi-line explanatory comment that precedes the `describe` in the original
  (lines 139–146 — the note about the unit-level crash-survival proofs no longer depending
  on `DispatchFixture.js` / dispatch-fixture-crash, see `#342`) together with the block.

Imports — only `Dispatcher`:

```js
import Dispatcher from '../../../lib/core/dispatcher.js';
```

Copy the module-level `fakeInvocationLog(events)` helper (with its JSDoc block) from the
original into this file. `jasmine` / `spyOn` / `expectAsync` are Jasmine globals — no import.
Do **not** copy `noopInvocationLog` (unused here).

## Files to Change

- `core/spec/lib/core/dispatcherInvocationLog_spec.js` — new; the `InvocationLog recording`
  `describe` plus its preceding comment and a copy of `fakeInvocationLog`, ~35 lines.
