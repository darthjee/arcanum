# Reuse the shared helper in SafeBranch_spec.js

`SafeBranch_spec.js`'s `'fetches and checks out the configured safe branch when the tree is clean'` test (in `#checkout (stubbed collaborators)`) hand-rolls the same `calls`-array + `jasmine.createSpy('execFileAsync').and.callFake(...)` fragment factored out into `core/spec/support/utils/execCallTracker.js` in step 01.

1. Import `trackedExecFileAsync` (or whatever name step 01 landed on) from `../../../support/utils/execCallTracker.js` (adjust the relative path to `SafeBranch_spec.js`'s actual location).
2. Replace the hand-rolled `calls`/`execFileSpy` block with a call to the helper, keeping the rest of the test (constructing `SafeBranch`, calling `checkout()`, asserting `calls` contains `['fetch', '-p']` and `['checkout', 'origin/develop']`) unchanged.
3. Check the other `execFileSpy`-based tests in this file (`'throws without checking out when the working tree has uncommitted changes'`, `'propagates unexpected git errors instead of treating them as "dirty"'`) — they use a different callback shape (branching on `args[0] === 'diff'`, or unconditionally rejecting) and are not part of the flagged duplication, so leave them as-is unless reusing the same helper turns out to fit cleanly without distorting their intent.

## Files to Change

- `core/spec/lib/commands/shared/SafeBranch_spec.js` — replace the hand-rolled `execFileAsync` call-tracking spy in the "fetches and checks out the configured safe branch" test with the shared `core/spec/support/utils/execCallTracker.js` helper.
