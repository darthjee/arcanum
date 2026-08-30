# Registry: context and validateRepoPath

Opt the seven `auto-fix-all-queue-*` entries into the `context: 'repo'` dispatch
path so `Dispatcher` builds and injects the `RepoContext` and strips the leading
`repoPath` arg. Keep the Dispatcher-level `RepoContext#validate()` only for the
two GitHub-facing subcommands; mark the five file-only subcommands
`validateRepoPath: false` so they keep working against a non-git directory (the
shell scripts do no such check — see the parity constraint in `node.md`).

## What to change

In `core/lib/core/commands.js`, rewrite the seven one-line queue entries
(currently lines ~114–120) to the multi-line shape used by the rest of the file:

- `auto-fix-all-queue-save` → add `context: 'repo'` (validation on).
- `auto-fix-all-queue-push` → add `context: 'repo'` (validation on).
- `auto-fix-all-queue-empty` → add `context: 'repo', validateRepoPath: false`.
- `auto-fix-all-queue-list` → add `context: 'repo', validateRepoPath: false`.
- `auto-fix-all-queue-next` → add `context: 'repo', validateRepoPath: false`.
- `auto-fix-all-queue-pop` → add `context: 'repo', validateRepoPath: false`.
- `auto-fix-all-queue-wait-next` → add `context: 'repo', validateRepoPath: false`.

Keep the existing key order (`empty`, `list`, `next`, `pop`, `push`, `save`,
`wait-next`) — `commands_spec.js` asserts the `context: 'repo'` list by exact
ordered array (step 04), and `Object.keys` order is insertion order.

Update the file-header JSDoc block (the `@property {'repo'|'claude'|'none'}
[context]` typedef around lines 13–28):

- Move `auto-fix-all-queue-*` out of the `'none'` / absent bullet (line ~28).
- Add it to the `'repo'` bullet's list (line ~19–22), noting that
  `save` / `push` validate and the file-only subcommands set
  `validateRepoPath: false` (its `repoPath` is only a queue-file path prefix).

## Files to Change

- `core/lib/core/commands.js` — `context: 'repo'` on all seven
  `auto-fix-all-queue-*` entries; `validateRepoPath: false` on `empty` / `list` /
  `next` / `pop` / `wait-next`; update the `context` typedef doc comment.
