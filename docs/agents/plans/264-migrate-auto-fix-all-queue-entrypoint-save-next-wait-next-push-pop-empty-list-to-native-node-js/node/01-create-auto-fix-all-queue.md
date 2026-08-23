# Create AutoFixAllQueue.js

Create `core/lib/AutoFixAllQueue.js` (zero runtime deps, built-in Node APIs only), the native counterpart of the split `queue_<subcommand>_shell.sh` scripts, with one method per subcommand:

- `save(repoPath, ...ids)` — overwrite `.claude/state/auto-fix-all-queue.json` with the given ids (as `{id}` entries), print `Queue saved: <ids>`, then best-effort call the label-mutation helper (below) for each id. No locking (matches today's `save`, which isn't lock-guarded).
- `next(repoPath)` — print the first entry's `id`, or empty string if the queue is empty/absent. No locking (read-only).
- `waitNext(repoPath)` — like `next`, but if the queue is empty, poll every `pollIntervalMs` (constructor-injectable, default 5000ms matching the shell's real `sleep 5`, with an injectable `sleepFn` — same precedent as `Lock.js`'s `sleepMs` and `AutoFixAllWaitCi.js`'s `sleepFn`/`pollIntervalMs`) until non-empty, then print the first id. This is the one method a genuinely bounded/mockable poll matters for — see [node.md](../node.md)'s Notes.
- `push(repoPath, ...ids)` — acquire the lock (`core/lib/Lock.js`, at `.claude/state/auto-fix-all-queue.lock`), append the given ids to the queue array, release the lock, print `Pushed: <ids>`, then best-effort call the label-mutation helper for each id.
- `pop(repoPath)` — acquire the lock, remove the first entry, release the lock. No stdout (matches today's `pop`).
- `empty(repoPath)` — resolve (no throw) when the queue has zero entries; throw `DispatchFailure('', 1)` when it has one or more (mirrors `AutoFixAllConfig.js`'s `isEnabled` shape for a "silent exit-code-only" subcommand).
- `list(repoPath)` — print each id on its own line, or `(empty)` if the queue has zero entries.

Read the queue file the same way `_read_queue` does today: `.claude/state/auto-fix-all-queue.json` under `repoPath`, treated as `[]` when absent or empty.

**Label mutation helper** (`save`/`push` only): for each given id, best-effort add the `Enqueued` label and remove the `Ready for Work`/`Created` labels from the corresponding GitHub issue — reuse `core/lib/Tags.js`'s `LABEL_TO_TAG` table (inverted, or add a small local reverse-lookup) to go from the canonical tag names (`enqueued`, `ready_for_work`, `created`) to their exact GitHub label names, rather than hardcoding a second copy of that mapping. A failed mutation (add or remove) warns to stderr (`Warning: could not add/remove '<label>' tag ... issue #<id> on <repo>`, matching today's `_mark_enqueued` wording) and must never throw/block the queue mutation itself — the queue write has already happened by the time this runs. Reuse `core/lib/Origin.js` (repo ref resolution) and `core/lib/GithubToken.js` (token resolution) the same way `AutoFixAllWaitCi.js`/`AutoFixAllConfig.js` do; there is no existing native add/remove-label GitHub API call to reuse, so write it here using `fetch` directly (per `docs/agents/architecture/script-engine.md`'s "no GitHub SDK" rule) — no string-interpolated shell execution, no ambient `child_process.exec()`.

Constructor should accept injectable collaborators for testing (`lock`, `origin`, `githubToken`, `fetchFn`, `pollIntervalMs`, `sleepFn`, `timeoutMs`), following the same pattern as `AutoFixAllConfig.js`/`AutoFixAllWaitCi.js`.

## Files to Change

- `core/lib/AutoFixAllQueue.js` — new module, all 7 methods.
