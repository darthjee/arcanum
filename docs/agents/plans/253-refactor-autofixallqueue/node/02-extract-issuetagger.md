# Extract IssueTagger

Create `core/lib/IssueTagger.js`: a generic (not `AutoFixAll`-prefixed) class that owns all GitHub label-mutation logic, so it can be reused by future skills outside the queue context.

Constructor takes `{ origin = new Origin(), githubToken = new GithubToken(), fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }` — the same defaults `AutoFixAllQueue` currently uses for these four collaborators (move `DEFAULT_TIMEOUT_MS` and the `TAG_TO_LABEL` reverse-mapping of `LABEL_TO_TAG` here too, since both are only used by this logic).

Move from `AutoFixAllQueue.js`, renaming each to drop the leading underscore:

- `_markEnqueued(repoPath, ids)` → `markEnqueued(repoPath, ids)`
- `_mutateTag(id, repo, repoRef, token, action, tag)` → `mutateTag(...)`
- `_fetchLabels(id, repo, token)` → `fetchLabels(...)`
- `_addLabel(id, repo, token, label)` → `addLabel(...)`
- `_removeLabel(id, repo, token, label)` → `removeLabel(...)`
- `_warnMutationFailure(action, tag, id, repoRef)` → `warnMutationFailure(...)`

Preserve behavior exactly, including:
- The direct `process.stdout`/`process.stderr` writes and their exact message text/order (validated today by `AutoFixAllQueue_spec.js`'s captured-stdout assertions).
- `markEnqueued`'s resolution of `origin`/`githubToken` throwing `DispatchFailure('', 1)` on failure (not swallowed, unlike per-tag mutation failures which are best-effort).

`markEnqueued` still needs `repoPath` (to resolve `origin`/`githubToken`) — same signature shape as today's `_markEnqueued`.

## Files to Change
- `core/lib/IssueTagger.js` — new file; the extracted class described above.
