# Create AutoFixAllGithubPrAndBranch_spec.js

New file: **`core/spec/lib/commands/auto-fix-all/AutoFixAllGithubPrAndBranch_spec.js`**.

Contains the PR/branch side of `AutoFixAllGithub_spec.js`, moved verbatim — these four
`describe` blocks (9 `it`s total):

- `#prNumber` (2 `it`s): `rejects when repoPath is missing`; `returns the cached pr_id when
  the branch matches issue-<id> and a cache entry exists`
- `#prState` (2 `it`s): `rejects when repoPath is missing`; `prints STATE=OPEN for an open,
  unmerged pull request`
- `#prMerge` (3 `it`s): `rejects when repoPath is missing`; `merges with an empty body by
  default (merge_body_mode absent) and prints the PR URL`; `rejects with the merge-failure
  error when the merge REST call fails` — including the `PULL` constant declared at the top
  of this `describe` block (stays inline, it is block-scoped).
- `#cleanupBranch` (2 `it`s): `rejects when repoPath or id is missing`; `runs the remote
  delete, checkout, reset, and local delete, in order`

Wrap all four in one self-qualifying top-level describe:

```js
describe('AutoFixAllGithub (PR & branch subcommands)', () => {
  // #prNumber / #prState / #prMerge / #cleanupBranch describe blocks, unchanged
});
```

Imports (these tests use `createAutoFixAllGithub`, `fakeGithubFetch`, and
`fakeGitExecFileAsync`; they assert on string literals, not the `REPO`/`TOKEN`/`REPO_PATH`
constants, so those are not imported here):

```js
import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  fakeGitExecFileAsync
} from '../../../support/factories/autoFixAllGithub.js';
```

Rename call sites inside the moved blocks: `newGithub(` → `createAutoFixAllGithub(`,
`fakeFetch(` → `fakeGithubFetch(`, `fakeExecFileAsync(` → `fakeGitExecFileAsync(`. No other
edits.

Original `AutoFixAllGithub_spec.js` is still left in place — removed in step 04.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubPrAndBranch_spec.js` — **new**; the
  `#prNumber` / `#prState` / `#prMerge` / `#cleanupBranch` describe blocks (9 `it`s) under
  `describe('AutoFixAllGithub (PR & branch subcommands)')`, importing helpers from the
  step-01 factory module.
