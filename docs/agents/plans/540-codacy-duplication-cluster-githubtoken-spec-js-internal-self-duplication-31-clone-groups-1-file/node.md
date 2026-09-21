# node Plan: Codacy: duplication cluster — GithubToken_spec.js internal self-duplication (31 clone groups, 1 file)

Main plan: [plan.md](plan.md)

## Context

`core/spec/lib/utils/github/GithubToken_spec.js` (204 lines, 11 `it` blocks across `#get` and `#ghUser`) repeats a `jasmine.createSpy('execFileAsync').and.callFake((file, args, options) => { if (args.join(' ') === '...') { ... } ... })` dispatcher in nearly every test, branching on the same handful of `gh`/`git` argument strings (`config user.ghuser`, `config --global user.ghuser`, `auth token`, `auth token --hostname github.com`, `auth switch --user <user>`). Codacy reports 31 clone groups / ~100 duplicated lines within this single file.

Of the 11 tests:
- 7 only assert on the resolved value or rejected error of `get()`/`ghUser()` given a fixed set of canned responses (`returns the token from gh auth token`, `falls back to --hostname...`, `throws the exact auth-failure message...`, `returns the local git config value...`, `falls back to the global git config value...`, `resolves to an empty string when unset at both levels`, plus the two `repoPath`/`repoContext` precedence tests which also assert on `options.cwd`).
- 2 assert on the sequence/content of calls made (`switches gh user first...`, `does not fail the whole call when gh auth switch itself fails`).

## Implementation Steps

### Step 1 — Extract a shared `execFileAsync` fake helper

Add a small local helper near the top of the `describe('GithubToken', ...)` block, e.g.:

```js
function fakeExecFileAsync(responses) {
  return jasmine.createSpy('execFileAsync').and.callFake((file, args) => {
    const key = args.join(' ');
    const response = responses[key];

    if (!response) {
      return Promise.reject(new Error('unexpected call'));
    }

    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}
```

`responses` maps an argument-string key (e.g. `'auth token'`, `'config user.ghuser'`) to either a `{ stdout, stderr }` success payload or an `Error` to reject with. This removes the repeated `if (args.join(' ') === ...) { return ...; }` chains from every test — the actual source of the 31 clone groups — while keeping each test's fixture data (which keys resolve/reject to what) explicit and readable.

Tests that also need to inspect call arguments/options (Step 2's two call-tracking tests, and the `repoPath`/`repoContext` precedence tests) keep their own `calls.push(...)`-wrapped spy built on top of the same `responses`-keyed dispatch logic, or call `fakeExecFileAsync` and separately assert via `execFileSpy.calls.allArgs()`/`execFileSpy.calls.argsFor(n)` — prefer reusing jasmine's own call-tracking over hand-rolled `calls` arrays where it removes the need for a second spy shape.

### Step 2 — Collapse the pure resolve/reject scenarios into `it.each`-style tables

Group the scenario-only tests (the 7 identified in Context) into two parameterized tables, one for `#get` and one for `#ghUser`, each row providing: a description, the `responses` map for `fakeExecFileAsync`, the `repoPath`/`repoContext` inputs, and the expected resolved value or rejected error. Use `it.each` (or an equivalent shared-example loop already in use elsewhere in `core/spec`, if a lint rule or existing convention prefers a manual `for` loop over `it.each`) to drive one `it(...)` per row.

Keep `switches gh user first when git config user.ghuser is set locally` and `does not fail the whole call when gh auth switch itself fails` as explicit standalone tests (built on the Step 1 helper) since their assertions are on call sequence, not on the resolved value alone, and don't fit the table shape cleanly.

Preserve exact current coverage: every token-resolution and gh-user-resolution path currently tested (env/config present, missing + gh CLI fallback, gh CLI failure, `auth switch` success/failure, `repoPath` vs. `repoContext.repoPath` precedence) must still have an equivalent test after the refactor.

## Files to Change

- `core/spec/lib/utils/github/GithubToken_spec.js` — extract the shared `execFileAsync` fake helper and replace the repeated scenario tests with parameterized tables, per Steps 1–2.

## CI Checks

- `core`: `yarn test` (CI job: `test`) — runs `c8 jasmine`, must still pass with unchanged coverage.
- `core`: `yarn duplication` (CI job: `checks`, non-blocking) — expected to show a substantial drop in this file's duplication score.

## Notes

- No changes to `core/lib/utils/github/GithubToken.js` (production code) are needed — this is spec-only deduplication.
- Follow the same shared-example/parameterization convention already applied in the sibling duplication-cluster fixes for issues #535–#539 for consistency across `core/spec`.
