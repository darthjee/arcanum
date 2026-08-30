# Registry spec + parity check

Update `core/spec/lib/core/commands_spec.js` for the seven new `context: 'repo'`
entries, and confirm the `autoFixAllQueueParity` and `dispatcher` specs still
pass without edits.

## `core/spec/lib/core/commands_spec.js`

The test at line ~12 (`sets context: 'repo' on the migrated ...`) asserts the
full `context === 'repo'` key list with `toEqual` against an exact ordered
array. `Object.keys` order is insertion order, and the queue entries sit between
`auto-fix-all-github-remove-tag` and `auto-fix-all-reply-comment` in
`commands.js`, so insert the seven names in that position, in file order:

```js
      'auto-fix-all-github-remove-tag',
      'auto-fix-all-queue-empty',
      'auto-fix-all-queue-list',
      'auto-fix-all-queue-next',
      'auto-fix-all-queue-pop',
      'auto-fix-all-queue-push',
      'auto-fix-all-queue-save',
      'auto-fix-all-queue-wait-next',
      'auto-fix-all-reply-comment',
```

Update the `it(...)` title to mention the queue family (e.g. "... auto-fix-all
lifecycle, auto-fix-all-github, auto-fix-all-queue and spawn-issue entries").

If a reviewer prefers it, additionally assert the `validateRepoPath: false`
subset:

```js
it("sets validateRepoPath: false on github-issue-info and the file-only auto-fix-all-queue subcommands", () => {
  const skipValidation = Object.keys(COMMANDS).filter((name) => COMMANDS[name].validateRepoPath === false);
  expect(skipValidation).toEqual([
    'auto-fix-all-queue-empty',
    'auto-fix-all-queue-list',
    'auto-fix-all-queue-next',
    'auto-fix-all-queue-pop',
    'auto-fix-all-queue-wait-next',
    'github-issue-info'
  ]);
});
```

(Adjust order to match `Object.keys` insertion order — the queue block precedes
`github-issue-info` in `commands.js`.)

## Parity specs — verify, no edits expected

- `core/spec/bin/autoFixAllQueueParity/save_spec.js` /
  `push_spec.js` — fixtures are `createGitFixtureRepo()` git repos, so the
  now-active `RepoContext#validate()` on `save` / `push` passes and stdout/exit
  parity with the shell side is unchanged. Confirm green.
- `core/spec/bin/autoFixAllQueueParity/{list,next,pop,empty,wait_next}_spec.js` —
  fixtures are plain `createTempDir()` dirs. These rely on
  `validateRepoPath: false` (step 01) so the native side does no git-repo check,
  matching the shell scripts. Confirm green — if any fails with a
  "not a git repository" error, step 01's `validateRepoPath: false` is missing
  on that entry.

## `core/spec/lib/core/dispatcher_spec.js` — verify, no edits expected

The dispatcher tests drive the `context: 'repo'` path via `spawn-issue` and the
`validateRepoPath: false` path via `github-issue-info`; neither enumerates the
queue commands, so no change. Confirm green.

## Files to Change

- `core/spec/lib/core/commands_spec.js` — extend the `context: 'repo'` expected
  array with the seven queue entries; update the test title; optional
  `validateRepoPath: false` assertion.
