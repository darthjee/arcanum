## Scenario and problem

Part of #308 — sub-issue 5, the final batch of the per-command migration.
Sub-issues 1–4 are merged: the `Dispatcher` / `core/lib/core/commands.js` /
`takesRepoContext` infra exists, and `arcanum-split-issue`, the `auto-fix-all`
lifecycle commands, `SpawnIssue`, and `AutoFixAllGithub` are already migrated.

This batch covers the resolve/fetch entrypoints plus the remaining
context-bound commands. Each takes `repoPath` as a leading positional method
argument today and re-derives context per call; move it to a `RepoContext`
supplied at construction by the `Dispatcher`, which builds
`new RepoContext({ repoPath: args[0] })` lazily and strips the leading
positional from the method args via `commandArgs()`.

Commands in scope, dispatched from `core/bin/arcanum` via
`core/lib/core/commands.js`:

| CLI name(s) | Module | Current constructor injectables | `RepoPath#validate` today |
|---|---|---|---|
| `resolve-and-fetch` | `commands/ResolveAndFetch.js` | `safeBranch`, `githubIssue` | no |
| `resolve-id-and-file` | `commands/ResolveIdAndFile.js` | none (no constructor) | no |
| `resolve-plan-paths` | `commands/ResolvePlanPaths.js` | none (no constructor) | no |
| `checkout-safe-branch` | `commands/SafeBranch.js` | `execFileAsync`, `repoConfig`, `repoPath` | yes (`run`) |
| `github-issue-create` / `github-issue-info` | `commands/GithubIssue.js` | `origin`, `githubToken`, `repoPath`, `fetchFn`, `timeoutMs`, `lock`, json\* helpers | `create` yes, `info` no |
| `issue-state` | `commands/IssueState.js` | `repoPath`, `lock`, `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths` | yes (`run`) |
| `list-agents` | `commands/ListAgents.js` | `repoPath` | yes (`run`) |

`GithubIssue` backs two registry entries (`github-issue-create` → `create`,
`github-issue-info` → `info`) — flip both together. `IssueState` backs one
(`issue-state` → `run`).

## Changes per command

- Set `takesRepoContext: true` on each entry in `core/lib/core/commands.js`
  (both `GithubIssue` entries together) and extend the asserted list in
  `core/spec/lib/core/commands_spec.js`. After this sub-issue the only entries
  still without the flag are the exempt set handled in sub-issue 6
  (`arcanum-update-run-update-*`, `auto-fix-all-config-*`,
  `auto-fix-all-queue-*`, `dispatch-fixture`, `dispatch-fixture-crash`,
  `permission-grant`).
- `constructor(repoContext, { ...injectables } = {})` — store
  `this._repoContext = repoContext`; keep each class's existing injectables
  (`execFileAsync`, `repoConfig`, `safeBranch`, `githubIssue`, `origin`,
  `githubToken`, `fetchFn`, `lock`, json\* helpers, `repoPathValidator`) only
  where they exist today.
- Replace the leading `repoPath` method parameter with
  `this._repoContext.repoPath`. `ResolveIdAndFile` and `ResolvePlanPaths` gain
  their first constructor (`constructor(repoContext)`, no injectables) — their
  migration is purely: drop the leading param, read `repoContext.repoPath`.
- **Validation parity**: preserve each command's current validate/no-validate
  behavior exactly — do not add `RepoPath#validate` where it is absent today
  (`ResolveAndFetch`, `ResolveIdAndFile`, `ResolvePlanPaths`,
  `GithubIssue#info`). Hoisting validation into `Dispatcher`/`RepoContext` is
  sub-issue 6.
- `ResolveAndFetch` still needs the raw `repoPath` string for
  `safeBranch.checkout`, `IssueFile.findExisting`, and `githubIssue.fetch` —
  source it from `repoContext.repoPath`. It can build `new GithubIssue(repoContext)`
  from its injected context instead of the zero-arg default.
- Build per-call helpers (`IssueClient`, `IssueStateService`, `IssueTagger`)
  off the injected context, following the `RepoContextFactory#buildFromContext(this._repoContext)`
  pattern already used by `AutoFixAllGithub`. `RepoContext` exposes no
  `set`/`setJson` passthrough and no public `origin`/`githubToken`/
  `issueStateService` accessors, so `IssueState` and `GithubIssue` must keep
  building their own per-call `IssueStateService` / `IssueClient` from the
  injected `RepoContext` rather than calling context methods directly.

### `GithubIssue` — shared-collaborator path

`GithubIssue` is also constructed zero-arg as a plain collaborator inside
`RepoContext` (`githubIssue = new GithubIssue()`, consumed by
`RepoContext#createIssue` → `this._githubIssue.create(this.repoPath, …)`), and
there is a pre-existing `RepoContext` ↔ `GithubIssue` circular import.

Shape: `constructor(repoContext, { origin, githubToken, repoPath, fetchFn,
timeoutMs, lock, … } = {})` with `repoContext` **optional**. Method arity is
**unchanged** — `create(repoPath, …)`, `info(repoPath)`, `fetch(repoPath, …)`
keep their leading `repoPath`.

- CLI path (`github-issue-create` / `github-issue-info`, flag on): the
  `Dispatcher` passes the `RepoContext`; the method reads
  `this._repoContext.repoPath` and forwards it to the unchanged method body.
- Shared-collaborator path: `RepoContext` keeps calling `new GithubIssue()`
  (no context) and `this._githubIssue.create(this.repoPath, …)` verbatim —
  nothing to change there.
- `ResolveAndFetch` (also being migrated here) builds
  `new GithubIssue(repoContext)` from its own injected context instead of the
  zero-arg default.

### `SafeBranch#checkout` — becomes context-bound

Drop the `repoPath` parameter from `SafeBranch#run()` / `SafeBranch#checkout()`;
both read `this._repoContext.repoPath`. This ripples beyond the seven commands:

- `commands/ResolveAndFetch.js` — construct `new SafeBranch(repoContext)` and
  call `this._safeBranch.checkout()` (no arg).
- `commands/ArcanumSplitIssueFinish.js` (already merged in sub-issue 2) —
  construct `new SafeBranch(this._repoContext)` and call
  `this._safeBranch.checkout()` (no arg).
- `core/spec/lib/commands/SafeBranch_spec.js` and
  `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — update
  construction + call sites accordingly.

## Call sites

`discuss-issue`, `enhance-issue`, `plan-issue`, `arcanum/_lib/*.sh`, and the
`arcanum-split-issue` wrappers call these entrypoints with `repoPath` as the
leading CLI positional. Leave that unchanged — `Dispatcher.commandArgs()`
strips it and rebuilds it into the `RepoContext`. The
`core/spec/bin/*Parity_spec.js` suites already pass `repoPath` after the
command name and need no changes; they are the safety net.

## Tests

- Update `core/spec/lib/commands/*_spec.js` for each command to construct with a
  real `RepoContext` wrapping fakes (as `SpawnIssue_spec.js` does via a
  `buildContext` helper), and drop the leading `repoPath` from `.run(...)`
  calls.
- Extend `core/spec/lib/core/commands_spec.js`'s `takesRepoContext` assertion
  list to include the seven flipped entries.
- Guard the `GithubIssue`-as-collaborator (zero-arg) path with an explicit
  spec if not already covered.
- Add a new `core/spec/lib/commands/IssueState_spec.js` — it does not exist
  today (`IssueState` is covered only by
  `core/spec/bin/issueStateParity_spec.js` and `IssueStateService_spec.js`).
  Construct `IssueState` with a `RepoContext` and cover the
  `get` / `set` / `set-json` / `append-json` dispatch, restoring the
  `lib` ↔ `spec` 1:1 mirror.
- Update `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` for the
  `SafeBranch` construction/call-site change (see above).

## Out of scope

- Flag removal, the `commandArgs()` branch removal, and hoisting `repoPath`
  presence/`RepoPath#validate` into `Dispatcher`/`RepoContext` (sub-issue 6).
- Exempt-command documentation (sub-issue 6).
