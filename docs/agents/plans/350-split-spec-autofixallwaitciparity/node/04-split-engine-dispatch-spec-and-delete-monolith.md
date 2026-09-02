# Split out engine_dispatch_spec.js, then delete the monolith

Create `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js`, containing the single
`engine_dispatch routing (via the real wait_ci.sh shim)` `describe` block (2 `it`s) moved
verbatim from the monolith, nested under the same top-level
`describe('auto-fix-all-wait-ci parity (shell vs. native)', ...)` wrapper (same as steps 02-03).
Keep the block's preceding explanatory comment (the one starting "Exercises the real
auto-fix-all/scripts/wait_ci.sh engine_dispatch shim...") — it documents non-obvious behavior
(why native-mode failures can't be faked the same way as the other describes' scenarios).

This file keeps two helpers **local to itself**, not imported from the shared factory (see
`node.md`'s Context section for why):

- `SHIM_SCRIPT` — `path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci.sh')`, with
  `REPO_ROOT` imported from `../../support/utils/runCommand.js`.
- `seedEngineMode(repo, mode)` — moved verbatim from the monolith (lines ~115-120): writes
  `repo.repoPath`'s `.claude/state/arcanum-config.json` with `{ engine: { mode } }`.

Other imports needed:

- `createFakeGhBin` (`../../support/utils/fakeGhBin.js`), `createGitFixtureRepo`
  (`../../support/utils/gitFixtureRepo.js`), `mkdir`/`writeFile` (`node:fs/promises`), `path`
  (`node:path`) — `mkdir`/`writeFile`/`path` are needed by the local `seedEngineMode`.
- `runCommand` from `../../support/utils/runCommand.js`.
- `seedGithubLikeRepo` from `../../support/factories/autoFixAllWaitCiParitySetup.js` (added in
  step 01) — both `it`s in this describe call it.

No assertions change — copy both `it` bodies exactly as they are in the monolith today.

## Delete the monolith

Once all three new files exist and each covers its describes verbatim, delete
`core/spec/bin/autoFixAllWaitCiParity_spec.js`. Do not leave it in place alongside the split
files — the issue's "Done when" requires it gone.

## Files to Change

- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js` — new file, as described above.
- `core/spec/bin/autoFixAllWaitCiParity_spec.js` — deleted.
