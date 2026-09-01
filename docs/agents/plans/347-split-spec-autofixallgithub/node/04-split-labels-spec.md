# Create AutoFixAllGithubLabels_spec.js and delete the original

## Create the Labels spec

New file: **`core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js`**.

Contains the label/tag side of `AutoFixAllGithub_spec.js`, moved verbatim — these three
`describe` blocks (17 `it`s total):

- `#hasShipitLabel` (5 `it`s): `rejects when repoPath is missing`; `rejects when id is
  missing`; `resolves for a case-insensitive exact "shipit" label match`; `rejects with an
  empty-stdout DispatchFailure (exit 1) when the label is absent`; `rejects with an
  empty-stdout DispatchFailure (exit 1) when the labels fetch fails`
- `#addTag` (6 `it`s): all six, unchanged
- `#removeTag` (6 `it`s): all six, unchanged

Wrap all three in one self-qualifying top-level describe:

```js
describe('AutoFixAllGithub (label subcommands)', () => {
  // #hasShipitLabel / #addTag / #removeTag describe blocks, unchanged
});
```

Imports — these tests use `createAutoFixAllGithub` / `fakeGithubFetch`, reference `REPO` in
URL assertions (e.g. `` `https://api.github.com/repos/${REPO}/issues/5/labels` ``), and the
`#hasShipitLabel` tests assert `toBeInstanceOf(DispatchFailure)`. `DispatchFailure` is a
production class, not a helper, so it keeps its direct import (note the `../../../../lib`
depth — one level deeper than the support import):

```js
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import {
  createAutoFixAllGithub,
  fakeGithubFetch,
  REPO
} from '../../../support/factories/autoFixAllGithub.js';
```

Rename call sites inside the moved blocks: `newGithub(` → `createAutoFixAllGithub(`,
`fakeFetch(` → `fakeGithubFetch(`. No other edits.

## Delete the original

Once all three new files exist and together hold every `it` from the original
(2 + 9 + 17 = 28), delete
**`core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js`**.

Cross-check before deleting: `grep -rn "AutoFixAllGithub_spec" core/spec core/lib core/bin`
returns nothing (already verified — no other file references it).

## Verify

Run `make core-test` and `make core-lint` (both operate on `core/`):

- `make core-test` — green; the three new files contribute 28 `it`s (same as the deleted
  file), so the repo-wide spec count is unchanged.
- `make core-lint` — clean (import ordering, quotes, indentation per
  `core/eslint.config.mjs`).
- Coverage for `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` unchanged versus before
  the split.

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js` — **new**; the
  `#hasShipitLabel` / `#addTag` / `#removeTag` describe blocks (17 `it`s) under
  `describe('AutoFixAllGithub (label subcommands)')`, importing helpers from the step-01
  factory module plus `DispatchFailure` directly.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js` — **deleted**; all content
  now lives in the three `AutoFixAllGithub*_spec.js` files.
