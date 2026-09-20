# Codacy: duplication cluster — arcanumUpdateRunUpdateParity check/apply pair (108 clone groups, 2 files)

## Context

`core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` repeats the same 7-8 line "run parity, assert stdout/exit" block four times internally (roughly lines 27-35, 42-50, 59-67, 76-83), and `apply_spec.js` shares an equivalent block with it almost verbatim (e.g. `apply_spec.js` lines 104-114 map to `check_spec.js` lines 79-89 and 30-49). Codacy reports 108 clone groups and roughly 140 duplicated lines across the pair.

## What needs to be done

- Introduce a shared `runUpdateParityScenario(fixtureState)` helper parameterized over the check/apply fixture variants.
- Replace the hand-copied run/assert blocks in both `check_spec.js` and `apply_spec.js` with calls to this helper.

## Acceptance criteria

- [ ] A shared `runUpdateParityScenario(fixtureState)` helper exists and is used by both `check_spec.js` and `apply_spec.js`.
- [ ] The duplicated run/assert blocks (including the internal repetition in `check_spec.js`) are removed in favor of the shared helper.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.
