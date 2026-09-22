# Issue: Codacy: duplication cluster — MergeBodyResolver_spec.js self-duplication + PrOperationsPrMerge_spec.js (17 clone groups, 2 files)

## Description

Codacy's duplication scan flagged 17 clone groups (~50 duplicated lines) between `core/spec/lib/utils/github/MergeBodyResolver_spec.js` and `core/spec/lib/utils/github/PrOperationsPrMerge_spec.js`, plus self-duplication inside `MergeBodyResolver_spec.js` itself.

The duplication comes from the same "coauthors" merge-body logic being tested at two layers with near-identical arrange/act/assert shapes:

- `MergeBodyResolver_spec.js` unit-tests `MergeBodyResolver#buildBody` directly, asserting on its return value (`{ included, body }`).
- `PrOperationsPrMerge_spec.js` re-tests the same logic indirectly through `PrOperations#prMerge()`, asserting on the `commit_message` field of the `githubClient.mergePr` call args instead.

Two scenarios are near-verbatim duplicates across the two files: "builds a deduped, email-sorted Co-authored-by block from the PR commits" and "falls back to `full` mode's behavior when the resulting list is empty". The `empty`/`full` mode tests (outside `coauthors` mode) follow the same parallel-but-not-identical pattern.

Within `MergeBodyResolver_spec.js`, the 8 `it`s under `describe('"coauthors" mode', ...)` also repeat the same arrange/act/assert boilerplate (build a `commits` array, wrap it via `coauthorsResolver(...)`, call `buildBody(7)`, assert on the result).

## Solution

Add a shared example module under `core/spec/support/sharedExamples/` (naming TBD by whoever implements this, e.g. `mergeBodyResolverSharedExamples.js`) following the existing cross-layer convention already used by `registerGithubIssueCreateSharedExamples` (`core/spec/support/sharedExamples/githubIssueCreateSharedExamples.js`): the shared example takes a callback that abstracts over how each caller obtains the actual result — `MergeBodyResolver_spec.js` calls `resolver.buildBody(...)` directly, `PrOperationsPrMerge_spec.js` calls `prOperations.prMerge()` and reads `githubClient.mergePr`'s call args — rather than the originally-proposed `resolvesMergeBody(template, expected)` shape, which doesn't map onto this code (there is no "template" concept here).

Scope: cover both the `coauthors` mode scenarios (where the literal duplicated clone groups are) and the `empty`/`full` mode scenarios (parallel structure between the two files, even though the assertions differ in shape).

Also reduce the self-duplication inside `MergeBodyResolver_spec.js`'s own `"coauthors" mode` describe block, where the 8 `it`s share nearly identical arrange/act/assert boilerplate — likely via the same shared example, parameterized by `commits`/config overrides/`modelEmail`/expected body.

## Acceptance criteria

- [ ] A shared example exists under `core/spec/support/sharedExamples/`, covering both `coauthors` mode and `empty`/`full` mode scenarios common to `MergeBodyResolver_spec.js` and `PrOperationsPrMerge_spec.js`, following the callback-based convention used by `registerGithubIssueCreateSharedExamples`.
- [ ] Both `MergeBodyResolver_spec.js` and `PrOperationsPrMerge_spec.js` use the shared example in place of their duplicated assertion blocks.
- [ ] `MergeBodyResolver_spec.js`'s internal repetition across its `"coauthors" mode` `it`s is also reduced.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.
