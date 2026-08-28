# Migrate IssueState + add IssueState_spec.js

`IssueState` (registry entry `issue-state` → `run`,
`core/lib/core/commands.js:143`) dispatches `get` / `set` / `set-json` /
`append-json` against an `IssueStateService` it builds per call. It validates
`repoPath` today (`IssueState.js:82`) — keep that. `RepoContext` has no
`set`/`setJson` passthrough, so the class must keep building its own
`IssueStateService` from the injected context.

## What to do

- Constructor →
  `constructor(repoContext, { repoPath = new RepoPath(), lock = new Lock(), jsonParser = new JsonParser(), jsonValueFormatter = new JsonValueFormatter(), jsonReader = new JsonReader(), issueStatePaths = new IssueStatePaths() } = {})`;
  store `this._repoContext = repoContext`, keep all existing injectables
  (`core/lib/commands/IssueState.js:40-54`).
- `run(subcommand, id, field, value)` (was
  `run(repoPath, subcommand, id, field, value)`, `IssueState.js:77`): read
  `const { repoPath } = this._repoContext`, keep
  `await this._repoPath.validate(repoPath)` (`:82`),
  `this._issueStatePaths.paths(repoPath, id)` (`:84`), `mkdir(stateDir, ...)`
  (`:86`), then `this._issueStateService()` (see next point). Subcommand
  dispatch (`:90-114`) is unchanged.
- `_issueStateService()` (was `_issueStateService(repoPath)`,
  `IssueState.js:125-136`): build the service off the **injected** context
  rather than a fresh `new RepoContext({ repoPath })` —
  `new IssueStateService({ context: this._repoContext, lock: this._lock, jsonParser: this._jsonParser, jsonValueFormatter: this._jsonValueFormatter, jsonReader: this._jsonReader, issueStatePaths: this._issueStatePaths })`.
  (`IssueStateService` reads `context.repoPath` / `context` internals the same
  way whether the context is fresh or injected.)
- Set `takesRepoContext: true` on `issue-state`
  (`core/lib/core/commands.js:143`) and add it to
  `core/spec/lib/core/commands_spec.js:12-35`.

## Tests — new file

`core/spec/lib/commands/IssueState_spec.js` does **not** exist today
(`IssueState` is only covered by `core/spec/bin/issueStateParity_spec.js` and
`core/spec/lib/services/IssueStateService_spec.js`). Create it, mirroring the
`SpawnIssue_spec.js` shape:

- A `buildContext({ repoPath })` helper wrapping fakes in a real
  `RepoContext` (or a minimal `{ repoPath }` context where the subcommand
  under test doesn't need collaborators).
- Construct `new IssueState(buildContext({ repoPath }), { ...stubbed deps })`
  with a temp-dir `repoPath`.
- Cover each subcommand dispatch: `run('get', id, field)`,
  `run('set', id, field, value)`, `run('set-json', id, field, jsonValue)`,
  `run('append-json', id, field, jsonValue)` — asserting the delegated
  `IssueStateService` method is invoked and the `mkdir` / `paths` wiring uses
  `repoContext.repoPath`.
- Cover the unknown-subcommand error path if `run` has one.
- Keep it aligned with `IssueStateService_spec.js` expectations so the two
  don't drift.

## Files to Change

- `core/lib/commands/IssueState.js` — `constructor(repoContext, { ... } = {})`,
  drop leading `repoPath` from `run`, build `IssueStateService` off
  `this._repoContext`.
- `core/lib/core/commands.js` — flag on `issue-state`.
- `core/spec/lib/commands/IssueState_spec.js` — **new file**.
- `core/spec/lib/core/commands_spec.js` — assertion list now includes
  `issue-state` (completing the seven; only the sub-issue 6 exempt entries
  remain unflagged).
