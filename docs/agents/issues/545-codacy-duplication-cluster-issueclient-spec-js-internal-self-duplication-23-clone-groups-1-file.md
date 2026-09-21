# Issue: Codacy: duplication cluster — IssueClient_spec.js internal self-duplication (23 clone groups, 1 file)

## Description

`core/spec/lib/utils/github/IssueClient_spec.js` contains a Codacy-flagged internal duplication cluster (23 clone groups, ~60 duplicated lines). `IssueClient` exposes five REST operations against the GitHub API — `getIssue`, `addLabel`, `removeLabel`, `createIssue`, `postComment` — and each of the last four follows the same three-test shape:

1. a "happy path" test asserting the correct `fetchFn` call,
2. `'throws a descriptive error when the response is not ok'`,
3. `'throws a descriptive error when fetch itself rejects'`.

Tests 2 and 3 are near-identical boilerplate across all four operations, differing only in which client method is invoked and the expected error string. `getIssue` has its own close variant plus a unique "malformed JSON response" test.

Note: the original issue text described this as a GraphQL/REST mix with 4 operations (fetch/create/comment/close) and an `it.each` table. Neither matches the current file — it's REST-only with 5 operations, and this codebase uses **Jasmine**, which has no `it.each` (that's a Jest API). The description below reflects the actual file and the parameterization pattern already established elsewhere in this repo (e.g. `core/spec/lib/utils/github/GithubToken_spec.js`, fixed under issue #541), which uses a plain `for (const {...} of cases) { it(...) }` loop instead.

## Solution

- Build a `cases` array of `{ description, method, args, expectedError }` (or similar) entries, one per operation (`addLabel`, `removeLabel`, `createIssue`, `postComment`), pairing a "not ok" case and a "fetch rejects" case.
- Drive both error scenarios through a single `for (const {...} of cases) { it(...) }` loop per scenario type, reusing the existing `newClient` factory.
- Leave each operation's distinct "happy path" test as-is, since those differ in arguments/assertions per operation and aren't part of the duplicated clone groups.
- `getIssue`'s extra "propagates a malformed (non-JSON) response as a rejection" test is unique to that operation and stays separate.
- Do not introduce `it.each` (unavailable under Jasmine) or a named `issueClientCallAssertion` helper unless the case-table + loop approach proves insufficient.

## Acceptance Criteria

- [ ] The repeated per-operation "not ok" / "fetch rejects" error-boilerplate tests in `IssueClient_spec.js` are replaced by parameterized case-table loops covering `addLabel`, `removeLabel`, `createIssue`, and `postComment`.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
