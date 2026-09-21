# Issue: Codacy: duplication cluster — GithubToken_spec.js internal self-duplication (31 clone groups, 1 file)

## Context
`core/spec/lib/utils/github/GithubToken_spec.js` (204 lines, 11 `it` blocks across `#get` and `#ghUser`) repeats the same `jasmine.createSpy('execFileAsync').and.callFake(...)` scaffolding in nearly every test: branch on `args.join(' ')` for `config user.ghuser`, `config --global user.ghuser`, `auth token`, `auth token --hostname github.com`, and `auth switch --user <user>`, resolving/rejecting a canned value, then asserting on the result via `expectAsync(...).toBeResolvedTo(...)`/`toBeRejectedWithError(...)`. Codacy reports 31 clone groups and roughly 100 duplicated lines within this single file — the same shape of internal self-duplication already fixed for sibling spec files in #535, #536, #537, and #538.

## What needs to be done
- Extract the repeated `execFileAsync` fake/branch-and-assert scaffolding into a parameterized `it.each`/shared-example table over the token- and gh-user-resolution strategies (env/config present, missing + gh CLI fallback, gh CLI failure, `auth switch` success/failure, `repoPath` vs. `repoContext.repoPath` precedence, etc.).
- Keep the small number of tests that assert on call arguments/options (e.g. the `cwd` passed through, `auth switch --user octocat` being called) as their own explicit tests where a table row cannot express the assertion cleanly.
- Follow the same shared-example convention used in the #535–#539 duplication-cluster fixes for consistency with the rest of `core/spec`.

## Acceptance criteria
- [ ] The repeated `execFileAsync` fake/branch/assert blocks in `GithubToken_spec.js` are replaced by a parameterized test (e.g. `it.each`) covering the same set of `#get`/`#ghUser` strategies.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
