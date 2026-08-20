# node Plan: Migrate resolve_and_fetch.sh to a native (Node.js) implementation

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — this plan produces the native side of the command key `resolve-and-fetch`, matching `scripter`'s simplified `#<id>`-only input grammar and exact `STATUS=`/`ERROR=` output contract byte-for-byte, including the state-file locking protocol and label→tag table.

## Steps

- [01 — Implement the native module](node/01-implement-native-module.md)
- [02 — Wire into core/bin/arcanum](node/02-wire-into-bin-arcanum.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Zero runtime dependencies — Node's built-in global `fetch` (Node 18+) and `child_process` (`execFile`/`spawn` with argument arrays, never string-interpolated `exec()`) only.
- `scripter`'s Step 05 (flipping `migration-status.json`) depends on all of this being committed and passing first — see [plan.md](plan.md)'s "Gating."
