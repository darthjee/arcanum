# Node Plan: Migrate permission-grant to a constructor-injected ClaudeContext

Main plan: [plan.md](plan.md)

## Shared contracts

### `context` registry enum (this agent owns it)

`CommandEntry.context: 'repo' | 'claude' | 'none'`, absent ≡ `'none'`:

- `'repo'` — `new ModuleClass(repoContext)` from `args[0]`; `args[0]` stripped.
  Mechanical conversion of every current `takesRepoContext: true` entry.
- `'claude'` — `new ModuleClass(claudeContext)` from `args[0]`; `args[0]`
  stripped. Only `permission-grant`.
- `'none'` / absent — `new ModuleClass()`, args untouched.

### argv this agent consumes (from scripter)

`core/bin/arcanum permission-grant` receives argv
`["<anchor>", "add", "<file>", "<pattern>"]`. `Dispatcher` (`context: 'claude'`)
strips `args[0]`, builds `ClaudeContext` from it, invokes
`run("add", "<file>", "<pattern>")`.

### `ClaudeContext` constructor + minimum surface (this agent defines it)

`new ClaudeContext({ repoPath })` — `repoPath` is the `<anchor>`. Mirrors
`RepoContext`'s `{ repoPath }` key. Must let `PermissionGrant` resolve a
possibly-relative `<file>` against the anchor instead of `process.cwd()`, and
expose the global settings path
(`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`).

## Steps

- [01 — Add ClaudeContext](node/01-add-claudecontext.md)
- [02 — Replace takesRepoContext with the context enum in the registry](node/02-context-enum-registry.md)
- [03 — Branch Dispatcher on the context enum](node/03-dispatcher-context-branch.md)
- [04 — Migrate PermissionGrant to context: 'claude'](node/04-migrate-permissiongrant.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `PermissionGrant#run(action, file, pattern)` keeps its signature and its
  `action !== 'add'` usage-message guard; only the constructor gains the leading
  `claudeContext` positional.
- Keep the `dispatch-fixture-repo-context` fixture on `context: 'repo'` — it
  still exercises the repo path end to end and is removed with #314, not here.
- Do not touch `arcanum/_lib/migration-status.json` or
  `docs/agents/architecture/entrypoint-migration-status.md` — the command key
  stays `permission-grant`.
