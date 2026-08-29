# Add the validateRepoPath registry opt-out and mark github-issue-info

`github-issue-info` is a `context: 'repo'` entry that must NOT get the hoisted
guard — it deliberately surfaces `Origin#resolve`'s
`Error: '<p>' is not a git repository or has no 'origin' remote` instead, and
`githubIssueInfoParity_spec.js` pins that. Add an explicit per-entry opt-out.

- In `core/lib/core/commands.js`, extend the `CommandEntry` typedef (around
  `:13-28`) with an optional `@property {boolean} [validateRepoPath]` — documented
  as "defaults to `true` for `context: 'repo'`; set `false` to skip the
  Dispatcher-level `RepoContext#validate()` (e.g. entries with their own
  not-a-repo error contract)". No effect for `context: 'claude'` / `'none'`.
- Add `validateRepoPath: false` to the `github-issue-info` entry (`:149-153`).
- Leave every other `context: 'repo'` entry untouched — absence ≡ `true`.

## Files to Change

- `core/lib/core/commands.js` — typedef `@property` for `validateRepoPath`;
  `validateRepoPath: false` on the `github-issue-info` entry.
