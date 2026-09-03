# Create check_spec.js

Create `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js`, containing the original
file's `describe('check', ...)` block (all 4 `it`s, verbatim — zip method, git method with an
exact tag, git method falling back to the short commit hash, `STATUS=missing_arcanum`), flattened
to a single top-level describe:

```js
describe('arcanum-update-run-update-check/-apply parity (shell vs. native) — check', () => {
  // the 4 `it`s, unchanged
});
```

(drop the original's outer wrapping `describe('arcanum-update-run-update-check/-apply parity
(shell vs. native)', ...)` — same flattening convention used by every sibling split, e.g.
`autoFixAllWaitCiParity/ci_outcomes_spec.js`'s
`describe('auto-fix-all-wait-ci parity (shell vs. native) — ci outcomes', ...)`.)

Imports needed: `createTempDir`, `removeTempDir` from `../../support/utils/tempDir.js`, and
`createZipFixture`, `createGitFixture`, `runPair` from
`../../support/factories/arcanumUpdateRunUpdateParitySetup.js` — both one level deeper than the
original's `../support/...` path, since this file now lives in a subdirectory of `bin/` (same
`../../support/...` depth every sibling split uses, e.g.
`autoFixAllWaitCiParity/ci_outcomes_spec.js`).

Give the file its own trimmed header comment (based on the original's, condensed to what's
relevant to `check`), cross-referencing `apply_spec.js` for the other subcommand's scenarios —
same style as e.g. `autoFixAllWaitCiParity/ci_outcomes_spec.js`'s "See preconditions_spec.js
for ..." cross-reference.

## Files to Change

- `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` — new file, the `check` half of the
  original spec.
