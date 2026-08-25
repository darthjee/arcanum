# Update githubParitySetup.js to use seedOriginUrl and drop expectParity

`core/spec/support/factories/githubParitySetup.js`'s `seedGithubLikeRepo` currently does the origin rewrite itself via the imported `git`:

```js
export async function seedGithubLikeRepo(repo) {
  await git(['remote', 'set-url', 'origin', FAKE_GITHUB_URL], repo.repoPath);
}
```

Change it to call the new shared helper instead, and drop the now-unused `git` import (nothing else in this file calls it):

```js
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}
```

Update the top import from `'../utils/runCommand.js'` to bring in `seedOriginUrl` instead of `git`.

Remove the `expectParity` function entirely from this file — it now lives in `runCommand.js` (added in step 01). Do this only after step 03 has repointed every caller's import, so nothing breaks in between; if committing step-by-step, this file's `expectParity` removal and step 03's import updates should land together (or in the order 03 → 02, whichever the actual commit sequence works out to — both edits must ship in the same test-passing state).

## Files to Change

- `core/spec/support/factories/githubParitySetup.js` — swap the `git` import for `seedOriginUrl`; rewrite `seedGithubLikeRepo`'s body to call it; delete the `expectParity` function and its export.
