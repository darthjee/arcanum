# node Plan: Codacy: duplication cluster — MergeBodyResolver_spec.js self-duplication + PrOperationsPrMerge_spec.js (17 clone groups, 2 files)

Main plan: [plan.md](plan.md)

## Context

Codacy flags 17 clone groups (~50 duplicated lines) between `core/spec/lib/utils/github/MergeBodyResolver_spec.js` and `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js`, plus self-duplication inside `MergeBodyResolver_spec.js`. Both files test the same merge-body-resolution logic (`empty`/`full`/`coauthors` modes) but at different layers:

- `MergeBodyResolver_spec.js` calls `resolver.buildBody(prNumber, modelEmail)` directly and asserts on its `{ included, body }` return value.
- `PrOperationsPrMerge_spec.js` calls `prOperations.prMerge()` and asserts on the `commit_message`/absence-of-`commit_message` in `githubClient.mergePr`'s call args instead.

Within `MergeBodyResolver_spec.js` itself, the 8 `it`s under `describe('"coauthors" mode', ...)` repeat the same arrange/act/assert shape (build a `commits` array, wrap via `coauthorsResolver(...)`, call `buildBody(7)`, assert).

The existing convention for this cross-layer situation is `core/spec/support/sharedExamples/githubIssueCreateSharedExamples.js`'s `registerGithubIssueCreateSharedExamples(buildInstance)`: a `buildInstance` callback abstracts over which class is under test, and the shared `it`s stay identical. This plan follows the same shape, with the callback abstracting over *how the actual result is obtained* (direct return value vs. mock call args) rather than which class is instantiated.

## Steps

- [01 — Add the merge-body-resolution shared example module](node/01-add-shared-example.md)
- [02 — Refactor MergeBodyResolver_spec.js to use the shared example](node/02-refactor-merge-body-resolver-spec.md)
- [03 — Refactor PrOperationsPrMerge_spec.js to use the shared example](node/03-refactor-pr-operations-pr-merge-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking — confirms the Codacy clone groups are gone)

## Notes

- Keep `MergeBodyResolver_spec.js`'s `#resolveMode` describe block and `PrOperationsPrMerge_spec.js`'s non-merge-body scenarios (cached `pr_id`/`pr_url`, branch deletion, merge-failure rejection, "never calls context methods directly") untouched — they're not part of the flagged duplication.
- The shared example's callback receives `{ commits, configValues, modelEmail }` and must return `{ included, body }` regardless of which spec is calling it, so the same `it` bodies and expectations work unmodified in both files.
- Verify coverage is unchanged after the refactor (`yarn test` reports coverage via `c8`) — the acceptance criteria require this explicitly.
