# Split out preconditions_spec.js

Create `core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js`, containing these 4
`describe` blocks moved verbatim from the monolith `autoFixAllWaitCiParity_spec.js`:

- `a missing required argument`
- `a present-but-non-directory repo_path`
- `a non-git repo_path`
- `no pull request found for the current branch`

All four nest directly under the same top-level
`describe('auto-fix-all-wait-ci parity (shell vs. native)', ...)` wrapper as the original —
keep that wrapper in this file too (each of the three split files re-declares it, same as the
existing `autoFixAllGithubParity/`/`autoFixAllQueueParity/` split files each do).

Imports needed:

- `path`, `createTempDir`/`removeTempDir` (`../../support/utils/tempDir.js`),
  `createFakeGhBin` (`../../support/utils/fakeGhBin.js`), `createGitFixtureRepo`
  (`../../support/utils/gitFixtureRepo.js`) — same paths as the monolith used, adjusted for
  this file's location one directory deeper.
- `runCommand`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD` from `../../support/utils/runCommand.js`
  (not redefined locally).
- `SHELL_SCRIPT`, `seedGithubLikeRepo` from
  `../../support/factories/autoFixAllWaitCiParitySetup.js` (added in step 01). Note: only the
  `no pull request found for the current branch` scenario needs `seedGithubLikeRepo` and
  `FAKE_FETCH_PRELOAD` (it spins up fixture repos and runs both shell and native sides); the
  first three scenarios only need `runCommand`/`NATIVE_BIN`/`SHELL_SCRIPT`/`createTempDir`/
  `removeTempDir`/`path`.

No assertions change — copy each `describe`/`it` body exactly as it is in the monolith today.

## Files to Change

- `core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js` — new file, as described above.
