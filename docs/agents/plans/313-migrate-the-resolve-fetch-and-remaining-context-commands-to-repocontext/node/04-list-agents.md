# Migrate ListAgents

`ListAgents` has a single injectable — the `repoPath` validator — and calls
`this._repoPath.validate(repoPath)` on every `run`. That validation behavior is
preserved (it exists today; do not remove it).

## What to do

- Constructor →
  `constructor(repoContext, { repoPath = new RepoPath() } = {})`; store
  `this._repoContext = repoContext` and keep `this._repoPath = repoPath`
  (`core/lib/commands/ListAgents.js:21`).
- `run(agentsDir = '.claude/agents')` (was
  `run(repoPath, agentsDir = '.claude/agents')`, `ListAgents.js:40`): read
  `const { repoPath } = this._repoContext`, keep
  `await this._repoPath.validate(repoPath)` (`:41`) and
  `path.join(repoPath, agentsDir)` (`:43`).
- Set `takesRepoContext: true` on `list-agents`
  (`core/lib/core/commands.js:144`) and add it to
  `core/spec/lib/core/commands_spec.js:12-35`.

## Tests

- `core/spec/lib/commands/ListAgents_spec.js` — the spec uses real fixture
  repos from `createGitFixtureRepo()`. Replace `new ListAgents()` with
  `new ListAgents(new RepoContext({ repoPath: repo.repoPath }))` and call
  `listAgents.run()` / `listAgents.run(agentsDir)` without the leading
  `repoPath`. The validator path stays exercised through the real fixture
  repo.
- `core/spec/lib/core/commands_spec.js` — assertion list now includes
  `list-agents`.

## Files to Change

- `core/lib/commands/ListAgents.js` — `constructor(repoContext, { repoPath } = {})`,
  drop leading `repoPath` from `run`.
- `core/lib/core/commands.js` — flag on `list-agents`.
- `core/spec/lib/commands/ListAgents_spec.js`
- `core/spec/lib/core/commands_spec.js`
