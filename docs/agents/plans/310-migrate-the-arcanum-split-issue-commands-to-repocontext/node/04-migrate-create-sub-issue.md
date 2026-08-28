# Migrate ArcanumSplitIssueCreateSubIssue

The command that also drops its own throwaway `RepoContext`. It uses `repoPath`
for `RepoPath#validate`, `path.resolve`, the `SpawnIssue#run` call, and the
per-call `IssueStateService` it builds for `appendJson`. `SpawnIssue` is not
migrated here — it keeps `run(repoPath, …)` and is fed
`this._repoContext.repoPath`.

## What to do

1. `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`:
   - Constructor → `constructor(repoContext, { spawnIssue = new SpawnIssue(),
     readFile: readFileFn = readFile, writeFile: writeFileFn = writeFile,
     mkdtemp: mkdtempFn = mkdtemp, rm: rmFn = rm, repoPathValidator = new
     RepoPath() } = {})`. Store `this._repoContext = repoContext`.
   - **Delete** the five `IssueStateService` knob params/fields (`lock`,
     `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths`) and
     the private `_issueStateService(repoPath)` helper entirely. Drop the now
     unused imports (`IssueStateService`, `Lock`, `JsonParser`, `JsonReader`,
     `JsonValueFormatter`, `IssueStatePaths`, and the local `RepoContext`
     import if nothing else uses it — it was only used by the deleted helper).
   - Rename `this._repoPath` → `this._repoPathValidator`.
   - `run(issueId, subIssueFile)` — drop the leading `repoPath` parameter.
   - Presence guard → `if (!this._repoContext.repoPath || !issueId ||
     !subIssueFile) throw new Error(USAGE)` (USAGE unchanged).
   - `await this._repoPathValidator.validate(this._repoContext.repoPath)`.
   - `path.resolve(this._repoContext.repoPath, subIssueFile)`.
   - The state-append line becomes:
     `await this._repoContext.appendIssueState(issueId, SUB_ISSUES_FIELD,
     JSON.stringify(newId));` (was
     `await this._issueStateService(repoPath).appendJson(issueId,
     SUB_ISSUES_FIELD, JSON.stringify(newId))`).
   - `_spawn(...)` helper: drop its `repoPath` param, call
     `this._spawnIssue.run(this._repoContext.repoPath, issueId, title, bodyFile,
     AS_SUBISSUE_FLAG)`. `_parse`, `_countLabel`, `_extractField` are
     `repoPath`-free — leave them.
   - Update class + method JSDoc (drop `repoPath` @param; note the state write
     now goes through `RepoContext#appendIssueState`).

2. `core/lib/core/commands.js` — `takesRepoContext: true` on
   `'arcanum-split-issue-create-sub-issue'`.

3. `core/spec/lib/core/commands_spec.js` — grow the `takesRepoContext`
   assertion to include `arcanum-split-issue-create-sub-issue` (registry order
   puts it first of the four).

4. `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js`:
   - Add `import RepoContext from '../../../lib/context/RepoContext.js';`.
   - `stubDeps()` → rename the `repoPath` key to `repoPathValidator`; keep the
     `spawnIssue.run` spy.
   - Construct as `new ArcanumSplitIssueCreateSubIssue(new RepoContext({
     repoPath }), deps)` — a **real** `RepoContext` around the existing
     `createTempDir()` `repoPath`, so the on-disk
     `.claude/state/issue-<ID>.json` assertions (currently at ~lines 188/233/246)
     stay verbatim and `appendIssueState` → `appendJson` runs for real.
   - `instance.run(repoPath, ISSUE_ID, subIssueFile)` → `instance.run(ISSUE_ID,
     subIssueFile)` throughout.
   - The "throws the usage message when repoPath is missing" case → construct
     with `new RepoContext({ repoPath: '' })` and call `instance.run(ISSUE_ID,
     subIssueFile)`; assert `deps.repoPathValidator.validate` not called.
   - `deps.spawnIssue.run` call-argument assertions: still expect the leading
     `repoPath` (now sourced from `this._repoContext.repoPath`) — value
     unchanged since it's the same temp dir.
   - No expected-output / stdout assertions change.

## Files to Change

- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js` — constructor takes `repoContext`; delete the five `IssueStateService` knobs + `_issueStateService` helper + now-unused imports; `run` / `_spawn` drop `repoPath`; state write via `this._repoContext.appendIssueState(...)`; `_repoPath` dep renamed `_repoPathValidator`.
- `core/lib/core/commands.js` — `takesRepoContext: true` on `arcanum-split-issue-create-sub-issue`.
- `core/spec/lib/core/commands_spec.js` — grow the `takesRepoContext` assertion.
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js` — construct with a real `RepoContext` + renamed deps; drop `repoPath` from `run(...)` calls.
