# Extract TagMutationService

Move the strict tag-mutation decision tree out of
`AutoFixAllGithub._mutateTag` into a new
`core/lib/services/TagMutationService.js`. `AutoFixAllGithub.addTag` /
`removeTag` become one-line delegations to a per-call service.

## `TagMutationService` API

- **Constructor** `{ issueTagger, context }`:
  - `issueTagger` — a context-bound `IssueTagger` (its `fetchLabels` /
    `addLabel` / `removeLabel` primitives are used directly; **not**
    `IssueTagger#mutateTag`, which warns-and-continues and writes to
    stdout/stderr).
  - `context` — the same `RepoContext`; used for `repoRef` via
    `context.resolveWithRef()` (replaces the current
    `this._origin.resolveWithRef(repoPath)` — same result, `{ repoRef }`).
- **`addTag(id, tag)`** / **`removeTag(id, tag)`** — public; each delegates to a
  private `_mutate(id, tag, action)` with `action` = `'add'` / `'remove'`.
- **`_mutate(id, tag, action)`** — the decision tree, lifted verbatim in
  behavior from `AutoFixAllGithub._mutateTag`:
  1. If `tag === 'shipit'` → `throw new Error('Error: shipit is human-only;
     scripts must not add or remove it')`.
  2. `const label = TAG_TO_LABEL[tag];` and
     `const { repoRef } = await this._context.resolveWithRef();`.
  3. `try { labels = await this._issueTagger.fetchLabels(id); } catch { throw
     new Error(\`Error: could not fetch issue #${id} from ${repoRef}\`); }`.
  4. `const present = labels.includes(label);` — if
     `action === 'add' ? present : !present`, return
     `` `Tag '${tag}' ${present ? 'already present on' : 'not present on'} issue #${id} — nothing to do.\n` ``
     (keep the exact existing phrasing: `already present on` for add,
     `not present on` for remove).
  5. `try { action === 'add' ? await this._issueTagger.addLabel(id, label) :
     await this._issueTagger.removeLabel(id, label); } catch { throw new
     Error(\`Error: could not update issue #${id} on ${repoRef}\`); }`.
  6. Return
     `` `${action === 'add' ? 'Added' : 'Removed'} tag '${tag}' ${action === 'add' ? 'to' : 'from'} issue #${id} on ${repoRef}\n` ``.
- **Returns strings, never writes.** The command's dispatch harness prints the
  returned line — mirrors today's `_mutateTag`.
- Keep `TAG_TO_LABEL` resolution inside the service (import from
  `../utils/issue/Tags.js`) — no new `IssueTagger` primitive.

## Adoption in `AutoFixAllGithub`

- Add `import TagMutationService from '../services/TagMutationService.js';`.
- Add a `_tagMutationService(repoPath)` builder:
  ```js
  _tagMutationService(repoPath) {
    const bundle = this._repoContextFactory.build(repoPath);
    return new TagMutationService({
      issueTagger: this._issueTaggerFactory(bundle),
      context: bundle.context
    });
  }
  ```
- `addTag(repoPath, id, tag)` keeps its `Usage:` arg check, then
  `return this._tagMutationService(repoPath).addTag(id, tag);`.
- `removeTag(repoPath, id, tag)` likewise →
  `return this._tagMutationService(repoPath).removeTag(id, tag);`.
- Delete `_mutateTag` from `AutoFixAllGithub`.
- `_issueTagger(repoPath)` stays (still used by `hasShipitLabel`).
- No `tagMutationServiceFactory` constructor param — construct inline; tests
  drive it through the injected `issueTaggerFactory` + fake `fetch`.

## Tests

- New `core/spec/lib/services/TagMutationService_spec.js` (mirror
  `PrChecker_spec.js` / `IssueStateService_spec.js` style — fake `issueTagger`
  with spy `fetchLabels`/`addLabel`/`removeLabel`, fake `context` with
  `resolveWithRef: async () => ({ repoRef })`):
  - `addTag` with the label already present → returns the exact
    `Tag '<tag>' already present on issue #<id> — nothing to do.\n`, no
    `addLabel` call.
  - `removeTag` with the label absent → returns
    `Tag '<tag>' not present on issue #<id> — nothing to do.\n`, no
    `removeLabel` call.
  - `addTag` mutating → calls `addLabel(id, TAG_TO_LABEL[tag])`, returns
    `Added tag '<tag>' to issue #<id> on <repoRef>\n`.
  - `removeTag` mutating → `Removed tag '<tag>' from issue #<id> on <repoRef>\n`.
  - `tag === 'shipit'` → rejects with the verbatim human-only `Error`, before
    any `fetchLabels` call.
  - `fetchLabels` throwing → rejects with
    `Error: could not fetch issue #<id> from <repoRef>`.
  - `addLabel` / `removeLabel` throwing → rejects with
    `Error: could not update issue #<id> on <repoRef>`.
  - the return value is a string and nothing is written to
    `process.stdout` / `process.stderr` (spy on `.write`).
- `AutoFixAllGithub_spec.js` `#addTag` / `#removeTag` blocks: behavior
  unchanged; keep the existing assertions on returned strings and on
  `origin.resolveWithRef` / `githubToken.get` call-through (now routed via the
  per-call service, still through the same shared instances).
- All `core/spec/bin/autoFixAllGithubParity/*` specs stay green — especially
  `add_tag_spec.js` and `remove_tag_spec.js`.

## Files to Change

- `core/lib/services/TagMutationService.js` — new; the service above.
- `core/lib/commands/AutoFixAllGithub.js` — import `TagMutationService`; add
  `_tagMutationService(repoPath)`; rewrite `addTag` / `removeTag` as
  delegations; delete `_mutateTag`.
- `core/spec/lib/services/TagMutationService_spec.js` — new; unit spec above.
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — adjust only if an
  assertion referenced `_mutateTag` directly; behavior expectations stay.
