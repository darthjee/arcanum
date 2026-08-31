# node Plan: Investigate removing dispatch-fixture / dispatch-fixture-crash

Main plan: [plan.md](plan.md)

## Shared contracts

`core/spec/lib/core/dispatcher_spec.js`'s `context: 'none'` unit-level proof must anchor on `auto-fix-all-config-get` (native: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js#get`), the same command `scripter` anchors `test_engine_dispatch.sh`'s parity cases on — see [plan.md](plan.md)'s "Shared contracts" for the full calling convention and expected output.

## Steps

- [01 — Remove the dispatch-fixture command entry](node/01-remove-command-entry.md)
- [02 — Remove DispatchFixture.js's run() method](node/02-remove-dispatch-fixture-run.md)
- [03 — Update arcanum_spec.js integration tests](node/03-update-arcanum-spec.md)
- [04 — Re-anchor dispatcher_spec.js's context:'none' proof](node/04-update-dispatcher-spec.md)
- [05 — Update commands_spec.js](node/05-update-commands-spec.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- `dispatch-fixture-crash` and `DispatchFixture.js#crash()` are out of scope — do not touch them, and do not touch any test coverage of `dispatch-fixture-crash` (tracked in #342).
- The `log: false` feature itself stays in `Dispatcher`/`commands.js` — only its now-orphaned `dispatch-fixture` test coverage is removed here (tracked further in #343).
