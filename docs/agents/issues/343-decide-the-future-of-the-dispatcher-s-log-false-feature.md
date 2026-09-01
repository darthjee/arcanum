# Issue: Decide the future of the Dispatcher's log:false feature

## Description
Split off from #340. `Dispatcher`'s `log: false` command-entry option (documented in `core/lib/core/commands.js`'s `CommandEntry` typedef: `false` skips `InvocationLog` recording for a command; any other value or absent means the invocation is logged) is real, general dispatcher behavior — but `dispatch-fixture` was the only entry in the `COMMANDS` table that ever set it.

### Current state (post-#340)

#340 has merged (commit `e68ede8`). It removed the `dispatch-fixture` entry from `COMMANDS` and deleted all three tests that exercised `log: false`:

- `core/spec/lib/core/commands_spec.js` — `'keeps log: false on dispatch-fixture'` (static table assertion).
- `core/spec/lib/core/dispatcher_spec.js` — `'does not record when the entry sets log: false'` (dispatcher skip-logging behavior).
- `core/spec/bin/arcanum_spec.js` — `'a dev/proof command excluded from logging (dispatch-fixture)'` (integration-level: log file left untouched).

What survives:

- `core/lib/core/dispatcher.js` — the `if (this.entry.log !== false) { await this._invocationLog.record(...) }` guard in `dispatch()`.
- `core/lib/core/commands.js` — the `@property {boolean} [log]` line in the `CommandEntry` typedef.

## Problem
`log: false` is now fully documented and fully implemented in the dispatcher, with zero users and zero tests — a wired-but-dead extension point. The dispatcher's `entry.log !== false` false-branch is uncovered (`c8` thresholds are 50% with `check-coverage: false`, so not CI-blocking, only a smell).

No future user is expected, on two counts:

- No planned command warrants it. The unmigrated entrypoints in `docs/agents/architecture/entrypoint-migration-status.md` are all real lifecycle/poll/monitor commands; the only "dev/proof" entry left, `dispatch-fixture-crash`, is deliberately logged (owned by #342).
- The logging mechanism itself is temporary. `docs/agents/architecture/script-engine.md` describes `engine.log.location` / `InvocationLog` as "temporary, debug-only instrumentation added for issue #244 ... expected to be removed once the native migration ... is complete." `log: false` is an opt-out knob on a mechanism already scheduled for deletion.

## Solution
Remove `log: false` from `Dispatcher` / `commands.js` entirely:

- Remove the `if (this.entry.log !== false)` guard in `core/lib/core/dispatcher.js#dispatch()` so every dispatched command is recorded via `InvocationLog#record`.
- Remove the `@property {boolean} [log]` line from the `CommandEntry` typedef in `core/lib/core/commands.js`, plus any prose that references it.
- Check `docs/agents/architecture/script-engine.md` and any migration/entrypoint-status docs for stale references to the `log` entry option and update them.
- No test changes are required beyond confirming the suite stays green — the three `log: false` tests were already removed by #340. Adjust any remaining dispatcher spec that assumed a command could opt out of logging.

Re-adding the feature later is trivial (one guard line, one `@property` line, one unit test), so nothing of value is lost by dropping it now.

### Rejected alternatives

- Keep it as a supported-but-unused `CommandEntry` option, re-anchoring a dispatcher-level test on a synthetic/mocked entry. Rejected: keeps dead surface and forces a test purely to cover a feature nobody uses.
- Wait for / find a real command that legitimately warrants `log: false`. Rejected: no such command is planned; leaving the issue open just preserves the wired-but-dead state.

### Scope

In scope: deleting the `log` option from the dispatcher and its typedef, plus doc cleanup.

Out of scope: `InvocationLog` itself and its `engine.log.location` behavior; `dispatch-fixture-crash` (deliberately left logged, handled by #342); introducing any new mechanism for suppressing logs.

## Benefits
- Removes a documented-but-unused extension point that invites "what uses this?" confusion.
- Eliminates an untested dispatcher branch.
- Keeps the dispatcher consistent with the #339→#343 cleanup chain of removing dev-only / unproven scaffolding.
