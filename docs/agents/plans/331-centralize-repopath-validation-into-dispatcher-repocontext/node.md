# Node Plan: Centralize repoPath validation into Dispatcher/RepoContext

Main plan: [plan.md](plan.md)

## Context

Today every `context: 'repo'` command's `run()` opens with a call equivalent to
`await this._repoPathValidator.validate(this._repoContext.repoPath)`.
`RepoPath#validate` (`core/lib/utils/file/RepoPath.js`) is the async shell-parity
contract for `arcanum/_lib/repo_path.sh`'s `repo_path_enter` validation half —
present / is-a-directory / is-a-git-repo — with the exact messages
`Error: repo_path is required` / `Error: not a directory: <p>` /
`Error: not a git repository: <p>`.

`Dispatcher.dispatch()` (`core/lib/core/dispatcher.js:45-56`) already builds the
`RepoContext` lazily from `args[0]` on the `context: 'repo'` path (getter at
`:81-84`) but never validates it. The natural insertion point is a new guarded
statement between `await this._invocationLog.record(...)` (`:51`) and
`const instance = await this.commandInstance()` (`:54`) — after `record`, before
`await import()` of the command module.

Audit results (from the issue's investigation):

- **13 modules validate today**, with naming drift — `repoPathValidator` /
  `_repoPathValidator` in `ArcanumSplitIssue{CreateSubIssue,CreateSubIssueFile,Finish,PushSubIssues}`,
  `AutoFixAllWaitCi`, `AutoFixAllWaitCiAndMerge`, `SpawnIssue`; `repoPath` /
  `_repoPath` in `AutoFixAllCheckoutFromMain`, `AutoFixAllCleanupArtifacts`,
  `SafeBranch`, `GithubIssue` (`create` only), `IssueState`, `ListAgents`.
- **5 surfaces do NOT validate today** but their `*_shell.sh` counterparts call
  `repo_path_enter`: `AutoFixAllGithub` (7 subcommands), `AutoFixAllReplyComment`,
  `ResolveAndFetch`, `ResolveIdAndFile`, `ResolvePlanPaths`. These come under the
  new uniform guard (a native/shell parity fix).
- **`github-issue-info` must stay exempt** — it surfaces `Origin#resolve`'s
  `Error: '<p>' is not a git repository or has no 'origin' remote`, pinned by
  `githubIssueInfoParity_spec.js`. Exempt it with a per-entry registry flag
  `validateRepoPath: false`.
- No command wraps the `validate()` call in try/catch — the rejection always
  propagates uncaught, and `core/bin/arcanum` already renders any thrown `Error`
  as `arcanum: <message>\n` + exit 1.
- Absent-leading-arg behaviour is **#333's** decision, not this issue's. This
  plan keeps current parity: `Dispatcher` calls `validate()` only when `args[0]`
  is truthy, so an absent leading arg still reaches the command's own `USAGE`
  throw. If #333 later chooses "always validate", that is a one-line change plus
  the parity-spec updates it will own.

## Steps

- [01 — Add RepoContext#validate() and its RepoPath collaborator](node/01-repocontext-validate.md)
- [02 — Add the validateRepoPath registry opt-out and mark github-issue-info](node/02-registry-opt-out.md)
- [03 — Hoist the validation call into Dispatcher.dispatch()](node/03-hoist-into-dispatcher.md)
- [04 — Guard RepoContext#createIssue with its own validate()](node/04-createissue-guard.md)
- [05 — Remove the per-command guard and RepoPath dependency from the 13 modules](node/05-strip-per-command-guards.md)
- [06 — Update unit specs (command, Dispatcher, RepoContext)](node/06-update-unit-specs.md)
- [07 — Re-verify and extend the shell-parity specs](node/07-parity-specs.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`)
- `make core-check` runs both.

## Notes

- **Ordering constraint**: the hoisted `validate()` must run *after*
  `InvocationLog#record` (so an invalid `repoPath` is still logged, matching
  today's ordering where `record` runs before the command module is imported)
  and *before* `await import()` of the command module. `dispatcher_spec.js`
  already asserts `record` completes before the module import via
  `fakeInvocationLog` ordering markers — add an assertion that `validate()` sits
  between them.
- **`RepoContext` is constructed with fake paths throughout the specs**
  (`dispatcher_spec.js` uses `/fake/repo`; command specs pass
  `{ repoPath: '' }`), so `validate()` must stay an explicit `async` method that
  only the `Dispatcher` (and `createIssue`) call — never the constructor.
- **`AutoFixAllGithub` `hasShipitLabel`**: today a bad repo yields a silent
  `DispatchFailure('', 1)` only via a downstream failure; under the hoisted guard
  a non-git path throws `Error: not a git repository: <p>` from the dispatch
  layer → `arcanum: Error: not a git repository: <p>` on stderr, exit 1. The
  shell (`github.sh` + `repo_path_enter`) already does exactly that, so it is a
  parity improvement — but it is a visible stderr change worth calling out in the
  PR description.
- **`GithubIssue`** is special: constructed zero-arg as a `RepoContext`
  collaborator (`RepoContext.js:2,35`) and its `create()` runs on both the CLI
  path and the `RepoContext#createIssue` collaborator path. Step 04 puts the
  guard on `RepoContext#createIssue` so the collaborator path (only in-process
  caller: `SpawnIssue.js:168`) keeps a validation guarantee after step 05 strips
  it from the module.
- **`SafeBranch`**: its guard is removed in step 05; `resolve-and-fetch` (which
  calls `this._safeBranch.checkout()`, not `.run()`) is itself a `context: 'repo'`
  entry and gets validated directly by the `Dispatcher`, so nothing regresses.
- Confirm no other command class is instantiated in-process from a
  non-dispatched path (grep for `new <CommandClass>(` outside `dispatcher.js` /
  specs). The known case is `SpawnIssue` → `RepoContext#createIssue`, handled by
  step 04.
