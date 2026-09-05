# Split #prMerge scenarios into PrOperationsPrMerge_spec.js and delete the original spec

Create `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js` with a top-level
`describe('PrOperations#prMerge', () => { ... })` (matches the split table in the issue),
containing:

- the `PULL` constant
- the 7 direct `it`s moved verbatim (`'merges with an empty body by default (merge_body_mode
  absent) and prints the PR URL'`, `'uses the cached pr_id/pr_url when the branch matches
  issue-<id> and both are cached, but still re-fetches the title via REST'`, `'omits
  commit_message entirely in "full" mode'`, `'sends an empty commit_message in "empty" mode'`,
  `'rejects with the merge-failure error when the merge REST call fails'`, `'deletes the branch
  ref after a successful merge'`, `'never calls context.getToken() or
  context.resolveWithRef() directly'`)
- the nested `'"coauthors" mode'` `describe`, with both of its `it`s (`'builds a deduped,
  email-sorted Co-authored-by block from the PR commits'` and `'falls back to "full" mode\'s
  behavior (omit commit_message) when the resulting list is empty'`)

Import `newPrOperations` from `core/spec/support/factories/prOperations.js` (step 01) instead
of redefining it locally.

Then delete `core/spec/lib/utils/github/PrOperations_spec.js` entirely — every scenario it held
now lives in one of the three new files from steps 02–04, so this is the step that resolves the
temporary duplication introduced by those steps back down to the original total test count.

## Files to Change

- `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js` — new file; the `#prMerge`
  scenarios (including the nested `"coauthors" mode` describe) moved verbatim from
  `PrOperations_spec.js:175-288`, importing `newPrOperations` from
  `core/spec/support/factories/prOperations.js`.
- `core/spec/lib/utils/github/PrOperations_spec.js` — deleted; fully superseded by the three
  new sibling spec files.

## Notes

- After this step, run `make core-test` and confirm the total spec/`it` count matches the
  pre-split baseline (21 `it`s — see [node.md](../node.md)'s Notes), and `make core-lint` is
  clean.
