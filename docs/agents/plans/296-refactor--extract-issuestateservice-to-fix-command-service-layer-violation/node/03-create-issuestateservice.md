# Create IssueStateService

Create `core/lib/services/IssueStateService.js` — the first class in a new `core/lib/services/` layer — holding the CRUD logic currently in `IssueState`, rebuilt on top of the utility classes from Steps 01–02.

Constructor:

```js
constructor({
  context,
  lock = new Lock(),
  jsonParser = new JsonParser(),
  jsonValueFormatter = new JsonValueFormatter(),
  jsonReader = new JsonReader(),
  issueStatePaths = new IssueStatePaths()
} = {})
```

- `context` (required) — a `RepoContext`, providing `context.repoPath`.

Methods (copy each body from `IssueState`, adapting to drop the `repoPath` parameter — read it from `this._context.repoPath` instead — and to call through the injected collaborators instead of private methods):

- `get(id, field)` — was `IssueState#get(repoPath, id, field)`.
- `set(id, field, value)` — was `IssueState#set(repoPath, id, field, value)`.
- `setJson(id, field, jsonValue)` — was `IssueState#setJson(repoPath, id, field, jsonValue)`.
- `appendJson(id, field, jsonValue)` — was `IssueState#appendJson(repoPath, id, field, jsonValue)`.
- `write(id, fields)` — was `IssueState#write(repoPath, id, fields)`.
- `_mutate(id, mutateFn)`, `_corrupt(id)`, `_writeRaw(stateFile, content)` — same internal skeleton as today, using `this._issueStatePaths.paths(this._context.repoPath, id)` instead of the old private `_paths`.

Every place `_parseJson`/`_formatValue`/`_read`/`_paths` was called directly, call the corresponding injected collaborator instead (`this._jsonParser.parse(...)`, `this._jsonValueFormatter.format(...)`, `this._jsonReader.read(...)`, `this._issueStatePaths.paths(...)`).

Move every test currently in `core/spec/lib/commands/IssueState_spec.js` (the `#write`/`#get`/`#set`/`#setJson`/`#appendJson` describe blocks — all 20 of them; there is no `#run` describe block there today, dispatch is covered separately by the parity spec, see [node.md](../node.md)'s Notes) into a new `core/spec/lib/services/IssueStateService_spec.js`. Adapt each test's setup: instead of `new IssueState()` and calling `issueState.write(repoPath, id, fields)`, construct `new IssueStateService({ context: new RepoContext({ repoPath }) })` and call `issueStateService.write(id, fields)` — repoPath moves from a per-call argument to the `RepoContext` passed at construction. Keep using the same `createTempDir`/`removeTempDir` real-filesystem style already in use.

## Files to Change

- `core/lib/services/IssueStateService.js` — new.
- `core/spec/lib/services/IssueStateService_spec.js` — new, ported from `core/spec/lib/commands/IssueState_spec.js`.
