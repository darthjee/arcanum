# Split `#info` into `GithubIssueInfo_spec.js`

Create `core/spec/lib/commands/shared/GithubIssueInfo_spec.js` with a single top-level
`describe('GithubIssue#info', ...)` containing:

- The current `#info` block's 3 `it`s (`GithubIssue_spec.js` lines 167–197), moved verbatim.
- The context-injected path's `#info` `it` (lines 373–385), moved verbatim into the same
  top-level describe (as a sibling `it`, not nested under a separate "context-injected"
  describe) — this is the one behavioral reorganization the issue calls for: keeping both
  calling conventions for `#info` side by side in one file.

Keep the existing `beforeEach`/`afterEach` temp-`repoPath` pair scoped to this file's
top-level `describe`. Import `loadFixture`/`stubDeps` from the factory module (step 01), and
`RepoContext` (needed by the context-injected `it`) alongside `GithubIssue`. Drop unused
imports (`writeFile`, `fileURLToPath`, `readFile` — `#info` doesn't touch the filesystem
beyond what `createTempDir`/`removeTempDir` already do).

## Files to Change

- `core/spec/lib/commands/shared/GithubIssueInfo_spec.js` — new file, ~55 lines: the 3
  original `#info` `it`s plus the 1 context-injected `#info` `it`, moved verbatim from
  `GithubIssue_spec.js`, importing `loadFixture`/`stubDeps` from the factory module.
