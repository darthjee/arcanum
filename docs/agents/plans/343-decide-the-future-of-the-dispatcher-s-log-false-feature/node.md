# node Plan: Decide the future of the Dispatcher's log:false feature

Main plan: [plan.md](plan.md)

## Overview

Delete the `log: false` command-entry opt-out from the native dispatcher. It is
the last artifact of the removed `dispatch-fixture` command: `Dispatcher#dispatch()`
still guards `InvocationLog#record()` behind `if (this.entry.log !== false)`, and
`CommandEntry` still documents a `[log]` property, but nothing sets it and no test
exercises it. After this change every dispatched command is recorded
unconditionally.

## Context

- #340 (commit `e68ede8`) removed the `dispatch-fixture` entry from `COMMANDS`
  and deleted its three `log: false` tests (`commands_spec.js`,
  `dispatcher_spec.js`, `arcanum_spec.js`). Nothing in the tree sets `log` today.
- Survivors:
  - `core/lib/core/dispatcher.js:55` — `if (this.entry.log !== false) { await this._invocationLog.record(this.command); }`
  - `core/lib/core/commands.js:10-11` — `@property {boolean} [log]` in the `CommandEntry` typedef.
  - `core/lib/core/commands.js:178-179` — the comment above `dispatch-fixture-crash`
    explains it is "deliberately left logged (entry.log !== false, the default)";
    the parenthetical references the property being removed.
- Re-adding the feature later is a ~3-line change (one guard line, one `@property`
  line, one unit test), so nothing of value is lost by dropping it now.
- `docs/agents/architecture/script-engine.md`'s `log` mentions are all about the
  `engine.log.location` config key / `InvocationLog` instrumentation — a
  different thing from `CommandEntry.log`. Leave that doc untouched.
- `dispatch-fixture-crash` keeps working unchanged: it is now logged like every
  other command (previously it was already logged, since it never set `log`), and
  its crash-survival purpose is unaffected. Entry ownership belongs to #342.

## Implementation Steps

### Step 1 — Remove the `log` opt-out from `Dispatcher#dispatch()`

In `core/lib/core/dispatcher.js`, drop the `if (this.entry.log !== false)`
wrapper so the `record` call is unconditional:

```js
    if (!this.entry) {
      throw new Error(`unknown command '${this.command}'`);
    }

    await this._invocationLog.record(this.command);

    if (this.entry.context === 'repo' && this.entry.validateRepoPath !== false) {
```

The class-level and `dispatch()` JSDoc blocks (lines 15-23 and 39-49) describe
`InvocationLog` recording as always happening ("awaited before the command
module is imported") and do not mention `log: false`, so they need no change —
re-read them after editing to confirm they still read correctly.

### Step 2 — Remove `[log]` from the `CommandEntry` typedef and refresh the comment

In `core/lib/core/commands.js`:

- Delete the `@property {boolean} [log]` line (and its continuation line) from
  the `CommandEntry` typedef.
- Reword the comment above the `dispatch-fixture-crash` entry so it no longer
  refers to `entry.log`. Keep the substance (the entry exists to prove
  `InvocationLog#record` runs and is awaited before the crashing module is
  invoked; as of #342 it backs only the process-level proof in
  `core/spec/bin/arcanum_spec.js`; do not reintroduce a unit-level dependency on
  it). For example, replace "is deliberately left logged (entry.log !== false,
  the default) —" with "is logged like every other command —".

No spec files change. `core/spec/lib/core/dispatcher_spec.js` already asserts
`invocationLog.record` is called with `'dispatch-fixture-crash'` on the
crash-survival path; that stays valid. There is no remaining test that asserts a
command can opt out of logging. Run the suite to confirm green.

## Files to Change

- `core/lib/core/dispatcher.js` — remove the `if (this.entry.log !== false)` guard in `dispatch()`; make `_invocationLog.record()` unconditional.
- `core/lib/core/commands.js` — remove the `@property {boolean} [log]` line from the `CommandEntry` typedef; reword the `dispatch-fixture-crash` comment to drop the `entry.log` reference.

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Removing the `entry.log !== false` guard eliminates a branch whose false side
  was uncovered, so c8 branch coverage does not regress (it marginally improves);
  `check-coverage` is `false` in `core/package.json` regardless.
- Out of scope: `InvocationLog` / `engine.log.location` behavior, the
  `dispatch-fixture-crash` entry itself (#342), and any new mechanism for
  suppressing invocation logs.
- No changes to `docs/agents/architecture/script-engine.md`,
  `entrypoint-migration-status.md`, or `arcanum/_lib/migration-status.json` —
  none reference the `CommandEntry.log` option.
