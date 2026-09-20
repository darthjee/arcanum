# Codacy: duplication cluster — GithubToken_spec.js internal self-duplication (31 clone groups, 1 file)

## Context

`core/spec/lib/utils/github/GithubToken_spec.js` (154 lines) repeats the same env-var-mock / `gh auth token` fallback assertion block at multiple offsets (roughly lines 12-19, 33-40, 89-96, 152-159, 170-177 are all the same 7-8 line shape), effectively testing 4-5 token-resolution paths by copy-paste rather than parameterization. Codacy reports 31 clone groups and roughly 100 duplicated lines within this single file.

## What needs to be done

- Convert the repeated blocks into a single parameterized `it.each`/shared-example over the token-resolution strategies (env var present, env var missing + gh CLI, gh CLI failure, etc.).
- Ensure all currently-covered token-resolution paths remain covered by the parameterized test.

## Acceptance criteria

- [ ] The repeated env-var-mock/token-fallback blocks in `GithubToken_spec.js` are replaced by a single parameterized test (e.g. `it.each`) covering the same set of strategies.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
