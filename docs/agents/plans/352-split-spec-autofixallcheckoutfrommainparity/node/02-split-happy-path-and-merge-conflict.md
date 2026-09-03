# Split branch-topology and merge-conflict describes

Create the new `core/spec/bin/autoFixAllCheckoutFromMainParity/` directory (mirroring
`autoFixAllWaitCiParity/`'s shape) and move two groups of `describe` blocks out of the original
monolith into it verbatim, each importing what it needs from step 01's factory module and from
`core/spec/support/utils/` (`createGitFixtureRepo`, `createTempDir`/`removeTempDir` where used).

`happy_path_spec.js` — the three branch-topology `describe` blocks, unchanged:
- `a fresh branch, with origin/main present (default fixture shape)`
- `an existing local branch, merged cleanly with origin/main`
- `a remote-only branch (no local ref)`

Imports `buildRepoPair` and `runPair` from the factory module (no other helper needed — none of
these three describes seed a branch beyond what `buildRepoPair`'s default does, except the
second, which passes `seedExistingLocalBranch`, and the third, which passes
`seedRemoteOnlyBranch` — both also imported from the factory).

`merge_conflict_spec.js` — the one `describe` block:
- `a real merge conflict`

Imports `buildRepoPair`, `runPair`, and `seedConflictingBranch` from the factory module.

Both files keep the original module-level `describe('auto-fix-all-checkout-from-main parity
(shell vs. native)', ...)` wrapper text unchanged around their respective blocks, and copy the
top-of-file parity-test doc comment (the `// Parity test for the "auto-fix-all-checkout-from-main"...`
block) from the original monolith so each new file still explains what it's testing and why,
without needing the original file open alongside it.

## Files to Change

- `core/spec/bin/autoFixAllCheckoutFromMainParity/happy_path_spec.js` — new file; 3 `describe`
  blocks moved verbatim from the monolith.
- `core/spec/bin/autoFixAllCheckoutFromMainParity/merge_conflict_spec.js` — new file; 1
  `describe` block moved verbatim from the monolith.
