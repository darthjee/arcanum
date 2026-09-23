# Plan: Split GitHubClient_spec.js into smaller domain-focused spec files

Issue: [580-split-githubclient-spec-js-into-smaller-domain-focused-spec-files.md](../../issues/580-split-githubclient-spec-js-into-smaller-domain-focused-spec-files.md)

## Overview
Split the 616-line `core/spec/lib/utils/github/GitHubClient_spec.js` into six spec files grouped by domain, each under ~200 lines. The inline `newClient` helper moves into a reusable support factory, and the original file is deleted. Only specs are moved; no test or production behavior changes.

## Context
- The spec has 17 top-level `describe` blocks (15–74 lines each) and 51 declared `it(...)` cases. The table-driven "failed-request error mapping on read methods" block expands 2 of those cases over 9 methods, so jasmine runs more specs than 51.
- Two helpers are shared across blocks:
  - `newClient(fetchFn, git)` (lines 8–15) builds a `GitHubClient` from `createRepoContextMock`, with `REPO = 'darthjee/arcanum'`, `TOKEN = 'fake-token'` and `timeoutMs: 5`.
  - `fakeGit(branch)` is defined locally inside `describe('#createPr')`. It moves with that block.
- Precedent for the factory: `core/spec/support/factories/prOperations.js`, which exports `REPO` and builds on `createRepoContextMock` from `./repoContextFactory.js`. It is used by `PrOperationsPrMerge_spec.js` and its sibling specs.

## Steps

- [01 — Record the baseline spec count](node/01-record-baseline.md)
- [02 — Extract the GitHubClient spec factory](node/02-extract-factory.md)
- [03 — Move describe blocks into domain spec files](node/03-split-spec-files.md)
- [04 — Delete the original spec and verify](node/04-delete-and-verify.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking). Moving blocks must not introduce new clone groups. Keep the factory as the only copy of the client builder.

## Notes
- This is a pure move. Keep `describe`/`it` names and assertions byte-identical apart from the import lines and the helper name.
- Each new file keeps the `describe('GitHubClient', ...)` outer wrapper so jasmine output still groups the specs under `GitHubClient`.
- If a file ends up slightly over ~200 lines after imports are added, rebalance the grouping (e.g. move `#getPrCommits` into another file) rather than trimming tests.
