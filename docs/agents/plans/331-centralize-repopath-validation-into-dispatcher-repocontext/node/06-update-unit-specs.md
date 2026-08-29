# Update unit specs (command, Dispatcher, RepoContext)

## Command specs — remove the per-command validation coverage

For each migrated command spec: delete the "validates `repoPath` first" /
"short-circuits before … when repo-path validation fails" `it` blocks, the fake
`repoPathValidator` / `repoPath` (`{ validate: … }`) injections, and any
`expect(deps.repoPathValidator.validate).not.toHaveBeenCalled()` /
`expect(deps.repoPath.validate)…` assertions in the arg-missing cases. Keep each
spec's own `USAGE` / arg-arity assertions untouched.

Known short-circuit specs to delete (from the investigation):
`AutoFixAllCheckoutFromMain_spec.js:58`, `SafeBranch_spec.js:22`,
`SpawnIssue_spec.js:243`, `AutoFixAllWaitCi_spec.js:138`,
`AutoFixAllWaitCiAndMerge_spec.js:36`, `IssueState_spec.js:69`.

Specs carrying the fake injection (strip it): `ArcanumSplitIssueCreateSubIssue_spec.js`,
`ArcanumSplitIssueCreateSubIssueFile_spec.js`, `ArcanumSplitIssueFinish_spec.js`,
`ArcanumSplitIssuePushSubIssues_spec.js`, `AutoFixAllWaitCi_spec.js`,
`AutoFixAllWaitCiAndMerge_spec.js`, `SpawnIssue_spec.js`, `GithubIssue_spec.js`,
`IssueState_spec.js`, `ListAgents_spec.js`, `SafeBranch_spec.js`,
`AutoFixAllCheckoutFromMain_spec.js`, `AutoFixAllCleanupArtifacts_spec.js`
(check this one — its injection pattern may differ).

## Dispatcher spec

Add to `core/spec/lib/core/dispatcher_spec.js`:

- A `context: 'repo'` command with a **present-but-non-directory** leading arg
  rejects with `Error: not a directory: <p>` from `dispatch()` (before the
  command module is imported).
- Same with a **directory-but-not-git** leading arg → `Error: not a git
  repository: <p>`.
- Ordering: `InvocationLog#record` completes **before** the `validate()` call,
  which completes **before** the module import — extend the existing
  `fakeInvocationLog` ordering-marker assertions.
- An **absent** leading arg (`args = ['<command>']`) still dispatches into the
  command (no `validate()` call) — the `&& this.args[0]` guard. (Reference #333.)
- A `validateRepoPath: false` entry (`github-issue-info`) with a non-git leading
  arg is NOT validated by the dispatcher — it reaches the command. Use a fixture
  registry entry or `github-issue-info` itself with a stubbed module.
- A `context: 'claude'` / `context: 'none'` entry is never validated (existing
  "never builds a RepoContext" assertions may already cover `'none'`).

## RepoContext spec

Add to `core/spec/lib/context/RepoContext_spec.js`:

- `validate()` delegates to the injected `repoPathValidator.validate` with
  `this.repoPath`, and propagates its rejection.
- `createIssue()` calls `validate()` first: with a fake `repoPathValidator` that
  rejects, `createIssue` rejects and `githubIssue.create` is never called; with
  one that resolves, `githubIssue.create` is called with
  `(repoPath, title, bodyFile)`.

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — new validation + ordering + opt-out
  specs.
- `core/spec/lib/context/RepoContext_spec.js` — `validate()` and `createIssue()`
  guard specs.
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js` — strip fake
  validator injection + short-circuit spec.
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssueFile_spec.js` — same.
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — same.
- `core/spec/lib/commands/ArcanumSplitIssuePushSubIssues_spec.js` — same.
- `core/spec/lib/commands/AutoFixAllCheckoutFromMain_spec.js` — same.
- `core/spec/lib/commands/AutoFixAllCleanupArtifacts_spec.js` — same (verify
  pattern).
- `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` — same.
- `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js` — same.
- `core/spec/lib/commands/SafeBranch_spec.js` — same.
- `core/spec/lib/commands/GithubIssue_spec.js` — strip fake `repoPath` injection;
  keep `info()` coverage intact.
- `core/spec/lib/commands/IssueState_spec.js` — same as split-issue specs.
- `core/spec/lib/commands/ListAgents_spec.js` — same.
- `core/spec/lib/commands/SpawnIssue_spec.js` — same.
