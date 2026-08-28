# node Plan: Migrate the resolve/fetch and remaining context commands to RepoContext

Main plan: [plan.md](plan.md)

## Overview

Flip `takesRepoContext: true` for seven registry entries' commands and rework
each class to `constructor(repoContext, { ...injectables } = {})`, reading
`this._repoContext.repoPath` instead of a leading positional method argument.
The `Dispatcher` already builds `new RepoContext({ repoPath: args[0] })` lazily
and strips the leading positional via `commandArgs()` when the flag is set
(`core/lib/core/dispatcher.js:68-92`), so no `core/bin/arcanum` or
`Dispatcher` changes are needed.

Two commands are not mechanical:

- **`SafeBranch`** becomes fully context-bound (its `checkout()` loses the
  `repoPath` parameter), which forces `ResolveAndFetch` and the already-merged
  `ArcanumSplitIssueFinish` to change in the same step.
- **`GithubIssue`** takes an **optional** leading `repoContext` with method
  arity unchanged, so its zero-arg shared-collaborator construction inside
  `RepoContext` (`core/lib/context/RepoContext.js:35`) keeps working untouched.

Each step flips only its own registry entries and extends the asserted list in
`core/spec/lib/core/commands_spec.js:12-35`, so `yarn test` stays green after
every step. Preserve each command's **current** `RepoPath#validate`
behavior exactly — validation hoisting is sub-issue 6, not this one.

## Context

- Infra from sub-issues 1–4 is merged: `Dispatcher`
  (`core/lib/core/dispatcher.js`), `core/lib/core/commands.js`, and the
  `takesRepoContext` flag exist; `SpawnIssue`, `AutoFixAllGithub`, the
  `arcanum-split-issue` commands, and the `auto-fix-all` lifecycle commands
  are already migrated.
- Reference patterns to copy:
  - `core/lib/commands/SpawnIssue.js:57-63` — `constructor(repoContext, { ... } = {})`,
    `const repoPath = this._repoContext.repoPath`, helpers reached via the
    context.
  - `core/spec/lib/commands/SpawnIssue_spec.js:44-51` — `buildContext(...)`
    helper wrapping fakes in a **real** `RepoContext`; `.run(...)` called
    without a leading `repoPath`.
  - `core/lib/commands/AutoFixAllGithub.js:47-59` + `_prOperations`/`_issueTagger`
    — per-call helpers built via
    `RepoContextFactory#buildFromContext(this._repoContext)`
    (`core/lib/context/RepoContextFactory.js:99-107`).
- `RepoContext` (`core/lib/context/RepoContext.js:29-36`) exposes
  `resolve()`, `resolveWithRef()`, `getToken()`, `getIssueState()`,
  `appendIssueState()`, `readConfig()`, `createIssue()` — but **no**
  `set`/`setJson` passthrough and **no** public `origin`/`githubToken`/
  `issueStateService` accessors. `IssueState` and `GithubIssue` must therefore
  keep building their own per-call `IssueStateService` / `IssueClient` from the
  injected context.
- Pre-existing `RepoContext` ↔ `GithubIssue` circular import
  (`core/lib/context/RepoContext.js:2` / `core/lib/commands/GithubIssue.js:3`) —
  do not deepen it.
- `core/spec/bin/*Parity_spec.js` already pass `repoPath` as the leading CLI
  positional after the command name; they need no changes and are the safety
  net.
- End state after this sub-issue: the only registry entries still without
  `takesRepoContext` are the exempt set for sub-issue 6
  (`arcanum-update-run-update-*`, `auto-fix-all-config-*`,
  `auto-fix-all-queue-*`, `dispatch-fixture`, `dispatch-fixture-crash`,
  `permission-grant`).

## Steps

- [01 — Migrate GithubIssue (optional repoContext)](node/01-github-issue.md)
- [02 — Migrate SafeBranch + ResolveAndFetch + ArcanumSplitIssueFinish ripple](node/02-safebranch-resolve-and-fetch.md)
- [03 — Migrate ResolveIdAndFile + ResolvePlanPaths](node/03-resolve-id-and-plan-paths.md)
- [04 — Migrate ListAgents](node/04-list-agents.md)
- [05 — Migrate IssueState + add IssueState_spec.js](node/05-issue-state.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Run `yarn test` and `yarn lint` from `core/` after each step; the
  `commands_spec.js` assertion list is the tripwire that catches a missed flag
  flip.
- `IssueState` has no unit spec today — step 05 creates
  `core/spec/lib/commands/IssueState_spec.js` from scratch.
- Do not add `RepoPath#validate` to commands that lack it today
  (`ResolveAndFetch`, `ResolveIdAndFile`, `ResolvePlanPaths`,
  `GithubIssue#info`). Keep `repoPathValidator` injectable only where it
  already exists (`SafeBranch`, `GithubIssue`, `IssueState`, `ListAgents`).
- Skill `.md` / `arcanum/_lib/*.sh` call sites keep passing `repoPath` as the
  leading CLI positional — do not touch them.
