# Node Plan: Codacy: duplication cluster — IssueClient_spec.js internal self-duplication (23 clone groups, 1 file)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Extract shared error-case table for addLabel/removeLabel/createIssue/postComment

In `core/spec/lib/utils/github/IssueClient_spec.js`, each of the `#addLabel`, `#removeLabel`, `#createIssue`, and `#postComment` `describe` blocks currently repeats:

- `'throws a descriptive error when the response is not ok'` — builds a `fetchFn` spy resolving to `{ ok: false }`, calls the client method, and asserts `toBeRejectedWithError(<message>)`.
- `'throws a descriptive error when fetch itself rejects'` — builds a `fetchFn` spy rejecting with `new Error('network error')`, calls the client method, and asserts `toBeRejectedWithError(<message>)`.

Replace these 8 near-identical `it(...)` blocks with a single `cases` array — one entry per operation, each carrying at minimum the operation's `description` label, the method name/args to invoke, and the expected error message — driven by a plain `for (const {...} of cases) { it(...) }` loop per scenario type (`not ok`, `fetch rejects`). This mirrors the pattern already in use in `core/spec/lib/utils/github/GithubToken_spec.js` (fixed under issue #541) — do not use Jest's `it.each`, since this codebase runs on Jasmine, which has no such API.

Leave untouched:
- Each operation's distinct "happy path" test (different args/assertions per operation, not part of the duplicated clone groups).
- The `#getIssue` `describe` block entirely — it has its own close variant plus a unique "propagates a malformed (non-JSON) response as a rejection" test that breaks the clean 3-test symmetry of the other four operations, so it stays out of the shared table.

## Files to Change

- `core/spec/lib/utils/github/IssueClient_spec.js` — replace the 8 duplicated error-boilerplate `it(...)` blocks (2 per operation × 4 operations) with a shared case-table + `for...of` loop, per the pattern in `GithubToken_spec.js`.

## CI Checks

- `core`: `yarn test` (CI job: `test`) — spec must still pass with unchanged coverage.
- `core`: `yarn duplication` (CI job: `checks`, non-blocking) — Codacy duplication score for this file should drop substantially.

## Notes

- No production code changes — this is a test-only refactor of `IssueClient_spec.js`.
- Keep the case entries expressive enough that each generated `it(...)` description still reads clearly per operation (e.g. interpolate the operation name into the description string) — the loop should not blur which operation a failing test belongs to.
