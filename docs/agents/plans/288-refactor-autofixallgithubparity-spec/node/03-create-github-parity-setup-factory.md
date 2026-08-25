# Create the setupParityTest factory

Create `core/spec/support/factories/githubParitySetup.js` with three exports:

**`seedGithubLikeRepo(repo)`** — move as-is from `core/spec/bin/autoFixAllGithubParity_spec.js` (lines 87–99).

**`setupParityTest({ ghVars, fetchVars } = {})`** (new) — orchestrates the repeated setup block identified in the issue (`core/spec/bin/autoFixAllGithubParity_spec.js` lines 10–24, duplicated across 9 of the 13 test cases):
1. `createFakeGhBin()` (from `core/spec/support/utils/fakeGhBin.js`).
2. `createGitFixtureRepo()` twice, for `shellRepo`/`nativeRepo` (from `core/spec/support/utils/gitFixtureRepo.js`).
3. `seedGithubLikeRepo` on both repos.
4. Build `fakeGhEnv` (`{ ...process.env, PATH: '<fakeGh.binDir>:' + process.env.PATH }`) and pass it to `seedEnv` (imported from `core/spec/support/utils/parityEnv.js`, step 02) with `{ ghVars, fetchVars }` to get `{ shellEnv, nativeEnv }`.
5. Return `{ shellRepo, nativeRepo, shellEnv, nativeEnv, fakeGh, cleanup() }`, where `cleanup()` awaits `Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])` — matching the `finally` block every caller currently repeats by hand.

**`expectParity(shell, native)`** — move as-is from `core/spec/bin/autoFixAllGithubParity_spec.js` (lines 80–87 of the issue's Solution section):
```js
function expectParity(shell, native) {
  expect(native.stdout).toEqual(shell.stdout);
  expect(native.code).toEqual(shell.code);
}
```

Note for step 05: `cleanup-branch` does **not** use `setupParityTest` — its two fixture repos never get a fake `gh`/env or a github-like `origin` rewrite (see the issue's "Note on `cleanup_branch_spec.js`"), so that split file builds its own repos directly via `createGitFixtureRepo`.

## Files to Change

- `core/spec/support/factories/githubParitySetup.js` — new file: `setupParityTest`, `seedGithubLikeRepo`, `expectParity`, each exported.
