# Split `#fetch` into `GithubIssueFetch_spec.js`

Create `core/spec/lib/commands/shared/GithubIssueFetch_spec.js` with a single top-level
`describe('GithubIssue#fetch', ...)` containing the current `#fetch` block's 8 `it`s
(`GithubIssue_spec.js` lines 44–165) moved verbatim, unchanged. Keep the existing
`beforeEach`/`afterEach` pair that creates/removes the temp `repoPath` (lines 34–42) scoped
to this file's top-level `describe`. Replace the inline `loadFixture`/`stubDeps` calls with
imports from the new `core/spec/support/factories/githubIssue.js` module (step 01). Keep the
existing imports for `GithubIssue`, `readFile`, `path` — drop `writeFile`, `RepoContext`, and
`fileURLToPath`, which are only used by other blocks. Do not touch
`core/lib/commands/shared/GithubIssue.js`.

## Files to Change

- `core/spec/lib/commands/shared/GithubIssueFetch_spec.js` — new file, ~140 lines, the 8
  `#fetch` `it`s moved verbatim from `GithubIssue_spec.js`, importing `loadFixture`/`stubDeps`
  from the factory module instead of defining them inline.
