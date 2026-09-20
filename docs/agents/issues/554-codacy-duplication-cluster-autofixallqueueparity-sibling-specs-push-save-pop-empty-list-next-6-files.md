# Codacy: duplication cluster — autoFixAllQueueParity sibling specs (push/save/pop/empty/list/next) (6 files)

## Context

Six sibling specs in `core/spec/bin/autoFixAllQueueParity/` follow the identical `setupParityTest`/`seedQueue` scaffold pattern:

- `push_spec.js`
- `save_spec.js`
- `pop_spec.js`
- `empty_spec.js`
- `list_spec.js`
- `next_spec.js`

`push_spec.js` repeats its own "seed queue, run shell vs. native, assert identical stdout/exit" scenario three times at different offsets (roughly lines 31-40/51-61/90-100 and 61-75/102-119), and shares an 8-10 line fragment of that scaffold verbatim with `save_spec.js` (roughly lines 41-51 vs. 36-46). The sibling `pop`/`empty`/`list`/`next` specs follow the same pattern per their shared imports and naming convention. Codacy reports roughly 30 clone groups and 70 duplicated lines across this family.

## What needs to be done

- Extract a single `itMatchesShellForQueueOp(op, seedState)` shared example on top of the existing `queueParitySetup.js` factory.
- Update each of the six operation-specific spec files to supply only its op name and seed data instead of re-authoring the run/assert scaffold.

## Acceptance criteria

- [ ] A shared `itMatchesShellForQueueOp(op, seedState)` example exists on top of `queueParitySetup.js` and is used by all six listed specs.
- [ ] The duplicated run/assert scaffolding (including internal repetition in `push_spec.js`) is removed in favor of the shared example.
- [ ] All six specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this family drops substantially after the fix lands.
