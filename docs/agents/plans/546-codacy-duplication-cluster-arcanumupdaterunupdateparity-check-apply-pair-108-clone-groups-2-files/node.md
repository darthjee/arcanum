# Node Plan: Codacy: duplication cluster — arcanumUpdateRunUpdateParity check/apply pair (108 clone groups, 2 files)

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add shared parity-assertion example](node/01-add-shared-parity-assertion-example.md)
- [02 — Dedupe check_spec.js](node/02-dedupe-check-spec.md)
- [03 — Dedupe apply_spec.js](node/03-dedupe-apply-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js`'s 4 tests all follow one shape: single fixture dir, `runPair(subcommand, dir, dir)`, then assert. `apply_spec.js`'s last test (`missing_arcanum`) follows the same shape; its other 3 tests use two separate fixture dirs (`shellDir`/`nativeDir`) with extra fixture files written into both before running shell/native manually via `runCommand` (not `runPair`). The shared helper's signature must accommodate both shapes — see Step 1's suggested `run()` closure design.
- Keep both specs' coverage unchanged (per the issue's acceptance criteria) — this is a pure refactor, no behavioral change to what's being asserted.
