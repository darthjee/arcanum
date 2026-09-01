# Create AutoFixAllGithubWiring_spec.js

New file: **`core/spec/lib/commands/auto-fix-all/AutoFixAllGithubWiring_spec.js`**.

Contains the current `describe('constructor wiring', ...)` block from
`AutoFixAllGithub_spec.js` (lines ~127–191), moved verbatim — both `it`s:

1. `shares the same origin/githubToken instances (through the injected RepoContext) across
   issueTagger/prOperations`
2. `routes every call through the injected execFileAsync/fetchFn via buildFromContext, bound
   to the context repoPath`

Wrap them in a self-qualifying top-level describe so test output stays readable across
files:

```js
describe('AutoFixAllGithub (wiring)', () => {
  // the two `it`s, unchanged
});
```

Imports (only what these two tests actually use — they call `createAutoFixAllGithub` /
`fakeGithubFetch` and reference `REPO`, `TOKEN`, `REPO_PATH`):

```js
import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  REPO,
  TOKEN,
  REPO_PATH
} from '../../../support/factories/autoFixAllGithub.js';
```

Rename call sites inside the moved block: `newGithub(` → `createAutoFixAllGithub(`,
`fakeFetch(` → `fakeGithubFetch(`. No other edits — the spy setup, `await`s, and
`expect`s are unchanged.

Do **not** delete the `constructor wiring` block from `AutoFixAllGithub_spec.js` yet — the
original file is removed wholesale in step 04, after all three new files exist.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubWiring_spec.js` — **new**; the
  `constructor wiring` describe block (2 `it`s) under
  `describe('AutoFixAllGithub (wiring)')`, importing helpers from the step-01 factory
  module.
