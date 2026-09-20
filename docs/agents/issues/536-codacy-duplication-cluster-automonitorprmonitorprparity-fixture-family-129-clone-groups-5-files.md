# Codacy: duplication cluster — autoMonitorPrMonitorPrParity fixture family (129 clone groups, 5 files)

## Context

Codacy flags heavy duplication across the parity spec family in `core/spec/bin/autoMonitorPrMonitorPrParity/`:

- `terminal_states_spec.js`
- `pending_spec.js`
- `shipit_spec.js`
- `commented_spec.js`
- `usage_error_spec.js`

Each file re-implements the same "seed a PR state, run shell vs. native parity, assert identical stdout/exit code" scaffold. `terminal_states_spec.js` alone repeats an identical 9-10 line PR-state-mock block four times (lines 12-21, 30-39, 56-65, 82-91), and the same block recurs verbatim across `pending_spec.js`, `shipit_spec.js`, and `commented_spec.js`. Codacy reports 129 clone groups and roughly 275 duplicated lines across this family.

## What needs to be done

- Add a shared `prStateParitySetup(state)` factory, parallel to the existing `queueParitySetup.js` pattern already used elsewhere in the spec suite.
- Add a shared `itMatchesShellForState(state)` shared example so each spec only supplies its distinguishing PR state instead of re-authoring the mock/assert scaffold.
- Apply both to all five files in `core/spec/bin/autoMonitorPrMonitorPrParity/`.

## Acceptance criteria

- [ ] A `prStateParitySetup(state)` helper exists and is reused by all five specs in `autoMonitorPrMonitorPrParity/`.
- [ ] A shared `itMatchesShellForState(state)` example replaces the duplicated per-state mock/assert blocks.
- [ ] All five specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this folder drops substantially after the fix lands.
