# Extract shared test helpers into a support factory

Create a new module holding the three helpers currently defined inline at the top of
`AutoFixAllGithub_spec.js`, so all three split spec files can share them instead of
duplicating ~90 lines each.

New file: **`core/spec/support/factories/autoFixAllGithub.js`**.

Move these verbatim from `AutoFixAllGithub_spec.js` (only renaming as noted):

- `fakeExecFileAsync({ branch = 'issue-5', failOn = [] })` → export as
  **`fakeGitExecFileAsync`**. Body unchanged (answers `git branch --show-current` with
  `branch`, rejects any `git` call whose joined argv contains a `failOn` substring, resolves
  everything else).
- `fakeFetch({ pulls, mergeOk, labels, issueViewFails, mutateOk })` → export as
  **`fakeGithubFetch`** (the bare name `fakeFetch` is already taken by the narrower
  `core/spec/support/utils/fakeFetch.js`). Body unchanged (routes `/pulls?head=`,
  `/pulls/:n/commits`, `PUT /pulls/:n/merge`, `GET /user`, `GET /issues/:id`,
  `POST|DELETE /labels` to canned responses).
- `newGithub(overrides)` → export as **`createAutoFixAllGithub`**. Body unchanged — it
  assembles an `AutoFixAllGithub` through a fake-backed `RepoContext` +
  `RepoContextFactory` + `BranchCleanup`, defaulting `execFileAsync` to
  `fakeGitExecFileAsync()` and `fetchFn` to `fakeGithubFetch()`.

Also move and export the three module-level constants the helper and the assertions depend
on:

```js
export const REPO = 'darthjee/arcanum';
export const TOKEN = 'fake-token';
export const REPO_PATH = '/fake/repo';
```

Imports the new module needs (path base is `core/spec/support/factories/`, so `../../../lib`
resolves to `core/lib` — matches the existing `repoContextFactory.js`):

```js
import AutoFixAllGithub from '../../../lib/commands/auto-fix-all/AutoFixAllGithub.js';
import BranchCleanup from '../../../lib/utils/git/BranchCleanup.js';
import RepoContext from '../../../lib/context/RepoContext.js';
import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';
```

Keep the existing JSDoc blocks on all three helpers (copy them across too — the
`spec/**/*.js` ESLint override turns `jsdoc/require-jsdoc` off, but the surrounding support
modules still carry doc comments, so match that style).

At this point `AutoFixAllGithub_spec.js` is left untouched and still passing — the new
module is additive. The spec file is rewired in steps 02–04.

## Files to Change

- `core/spec/support/factories/autoFixAllGithub.js` — **new**; holds
  `createAutoFixAllGithub`, `fakeGithubFetch`, `fakeGitExecFileAsync`, and the `REPO` /
  `TOKEN` / `REPO_PATH` constants, all lifted verbatim from `AutoFixAllGithub_spec.js`.
