# Migrate ArcanumSplitIssueCreateSubIssueFile

The simplest of the four — no external collaborators take `repoPath`; the class
only uses `repoPath` for `path.resolve` and `RepoPath#validate`.

## What to do

1. `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js`:
   - Constructor → `constructor(repoContext, { readdir: readdirFn = readdir,
     mkdir: mkdirFn = mkdir, readFile: readFileFn = readFile, writeFile:
     writeFileFn = writeFile, repoPathValidator = new RepoPath() } = {})`.
     Store `this._repoContext = repoContext`; keep the other `this._*`
     assignments; rename `this._repoPath` → `this._repoPathValidator`.
   - `run(issueId, title, bodyFile)` — drop the leading `repoPath` parameter.
   - Presence guard → `if (!this._repoContext.repoPath || !issueId || !title ||
     !bodyFile) throw new Error(USAGE)` (USAGE string unchanged).
   - `await this._repoPathValidator.validate(this._repoContext.repoPath)`.
   - Replace every remaining `repoPath` read with `this._repoContext.repoPath`
     (the `path.resolve(repoPath, bodyFile)` and `path.join(repoPath,
     ISSUES_DIR)` / `path.join(repoPath, ISSUES_DIR, fileName)` calls).
   - Update the class + `run` JSDoc (`@param` list loses `repoPath`; constructor
     JSDoc documents `repoContext` first).

2. `core/lib/core/commands.js` — add `takesRepoContext: true` to the
   `'arcanum-split-issue-create-sub-issue-file'` entry.

3. `core/spec/lib/core/commands_spec.js` — update the `takesRepoContext`
   assertion to expect `['arcanum-split-issue-create-sub-issue-file',
   'dispatch-fixture-repo-context']` (registry order), and rename the `it(...)`
   description (e.g. "sets takesRepoContext on the migrated
   arcanum-split-issue entries and the test fixture").

4. `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssueFile_spec.js`:
   - `stubDeps()` → rename the `repoPath` key to `repoPathValidator`.
   - Construct as `new ArcanumSplitIssueCreateSubIssueFile({ repoPath:
     <tempDir> }, deps)` — first arg a plain `{ repoPath }` literal (the spec's
     `repoPath` temp-dir variable), second arg the renamed `stubDeps()`.
   - Each `instance.run(repoPath, ISSUE_ID, 'Title', bodyFile)` → `instance.run(
     ISSUE_ID, 'Title', bodyFile)`.
   - The "throws the usage message when repoPath is missing" case → construct
     with `{ repoPath: '' }` and call `instance.run(ISSUE_ID, 'Title',
     bodyFile)`; assert `deps.repoPathValidator.validate` not called.
   - No expected-output / stdout assertions change.

## Files to Change

- `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js` — constructor takes `repoContext`; `run` drops `repoPath`; reads via `this._repoContext.repoPath`; `_repoPath` dep renamed `_repoPathValidator`.
- `core/lib/core/commands.js` — `takesRepoContext: true` on `arcanum-split-issue-create-sub-issue-file`.
- `core/spec/lib/core/commands_spec.js` — grow the `takesRepoContext` assertion; rename its `it(...)`.
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssueFile_spec.js` — construct with `{ repoPath }` literal + renamed deps; drop `repoPath` from `run(...)` calls.
