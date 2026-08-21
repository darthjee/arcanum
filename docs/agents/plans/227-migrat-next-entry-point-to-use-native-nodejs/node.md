# node Plan: Migrate next entry point to use native nodejs

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — this plan produces the native side of the command key `resolve-id-and-file`, matching `scripter`'s Scenario A/B/C behavior and exact `SCENARIO=`/`STATUS=`/`ERROR=` output contract byte-for-byte, including the hard-failure non-numeric-id precondition.

## Steps

- [01 — Implement the native module](node/01-implement-native-module.md)
- [02 — Wire into core/bin/arcanum](node/02-wire-into-bin-arcanum.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Zero runtime dependencies — Node's built-in `fs`/`path` only; no `child_process`, no `fetch` (this entry point never touches git or GitHub).
- Optional, not required: `core/lib/ResolveAndFetch.js` already has `_titleFromFilename`/`_findExistingFile`-equivalent logic. If a shared `core/lib/IssueFile.js` helper falls out naturally while writing Step 01, extract it (and update `ResolveAndFetch.js` to use it too); otherwise leave `ResolveAndFetch.js` untouched and don't force the refactor.
- `scripter`'s final step (flipping `migration-status.json`) depends on all of this being committed and passing first — see [plan.md](plan.md)'s "Gating."
