# Migrate ResolveIdAndFile + ResolvePlanPaths

The two purest migrations: both classes have **no constructor** and **no
collaborators / injectables** today, and neither calls `RepoPath#validate`.
They only use `repoPath` to resolve paths via `IssueFile.findExisting` and
`path.join`.

## ResolveIdAndFile

- Add `constructor(repoContext) { this._repoContext = repoContext; }`
  (`core/lib/commands/ResolveIdAndFile.js` currently has no constructor).
- `run(issuesFolder, argString = '')` (was
  `run(repoPath, issuesFolder, argString)`, `ResolveIdAndFile.js:29`): read
  `const { repoPath } = this._repoContext` and pass it to
  `IssueFile.findExisting(repoPath, issuesFolder, id)` in `_resolveA`
  (`:113`) and `_resolveC` (`:133`).
- Set `takesRepoContext: true` on `resolve-id-and-file`
  (`core/lib/core/commands.js:147`) and add it to
  `core/spec/lib/core/commands_spec.js:12-35`.

## ResolvePlanPaths

- Add `constructor(repoContext) { this._repoContext = repoContext; }`
  (`core/lib/commands/ResolvePlanPaths.js` currently has no constructor).
- `run(issuesFolder, plansFolder, id)` (was
  `run(repoPath, issuesFolder, plansFolder, id)`, `ResolvePlanPaths.js:31`):
  read `const { repoPath } = this._repoContext` and use it in
  `IssueFile.findExisting(repoPath, issuesFolder, id)` (`:38`),
  `this._exists(path.join(repoPath, planFile))` (`:47`), and
  `mkdir(path.join(repoPath, planDir), ...)` (`:49`).
- Set `takesRepoContext: true` on `resolve-plan-paths`
  (`core/lib/core/commands.js:148`) and add it to the assertion list.

## Tests

- `core/spec/lib/commands/ResolveIdAndFile_spec.js` — replace
  `new ResolveIdAndFile()` with
  `new ResolveIdAndFile(new RepoContext({ repoPath }))` (the temp-dir
  `repoPath` already set up per test), and drop the leading `repoPath` from
  `.run(...)` calls.
- `core/spec/lib/commands/ResolvePlanPaths_spec.js` — same treatment:
  `new ResolvePlanPaths(new RepoContext({ repoPath }))`, `.run(issuesFolder,
  plansFolder, '42')`.
- `core/spec/lib/core/commands_spec.js` — assertion list now includes
  `resolve-id-and-file` and `resolve-plan-paths`.

## Files to Change

- `core/lib/commands/ResolveIdAndFile.js` — add `constructor(repoContext)`,
  drop leading `repoPath` from `run`.
- `core/lib/commands/ResolvePlanPaths.js` — add `constructor(repoContext)`,
  drop leading `repoPath` from `run`.
- `core/lib/core/commands.js` — flags on `resolve-id-and-file`,
  `resolve-plan-paths`.
- `core/spec/lib/commands/ResolveIdAndFile_spec.js`
- `core/spec/lib/commands/ResolvePlanPaths_spec.js`
- `core/spec/lib/core/commands_spec.js`
