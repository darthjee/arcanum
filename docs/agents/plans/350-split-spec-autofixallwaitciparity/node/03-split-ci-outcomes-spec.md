# Split out ci_outcomes_spec.js

Create `core/spec/bin/autoFixAllWaitCiParity/ci_outcomes_spec.js`, containing these 3
`describe` blocks moved verbatim from the monolith `autoFixAllWaitCiParity_spec.js`, nested
under the same top-level `describe('auto-fix-all-wait-ci parity (shell vs. native)', ...)`
wrapper (same as step 02):

- `a passing PR`
- `a failing PR`
- `a PR with an ignored-pattern check-run alongside a real one`

Imports needed:

- `createFakeGhBin` (`../../support/utils/fakeGhBin.js`), `createGitFixtureRepo`
  (`../../support/utils/gitFixtureRepo.js`).
- `runCommand`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD` from `../../support/utils/runCommand.js`.
- `SHELL_SCRIPT`, `seedGithubLikeRepo`, `seedIgnoredCheckPatterns` from
  `../../support/factories/autoFixAllWaitCiParitySetup.js` (added in step 01) — all three
  describes use `seedGithubLikeRepo`; only `a PR with an ignored-pattern check-run alongside a
  real one` also uses `seedIgnoredCheckPatterns`.

No assertions change — copy each `describe`/`it` body exactly as it is in the monolith today,
including the `Codacy Static Code Analysis`/`action_required` comment in the ignored-pattern
scenario (explains why that check-run must be filtered rather than counted).

## Files to Change

- `core/spec/bin/autoFixAllWaitCiParity/ci_outcomes_spec.js` — new file, as described above.
