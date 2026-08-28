# Migrate SafeBranch + ResolveAndFetch + ArcanumSplitIssueFinish ripple

`SafeBranch` becomes fully context-bound: `run()` and `checkout()` lose their
`repoPath` parameter. `SafeBranch` is a collaborator of both `ResolveAndFetch`
(`core/lib/commands/ResolveAndFetch.js:40`, `this._safeBranch.checkout(repoPath)`)
and the already-merged `ArcanumSplitIssueFinish`
(`core/lib/commands/ArcanumSplitIssueFinish.js:80`,
`this._safeBranch.checkout(this._repoContext.repoPath)`), so all three classes
and their specs change together in this step.

## SafeBranch

- Constructor →
  `constructor(repoContext, { execFileAsync = defaultExecFileAsync, repoConfig = new RepoConfig(), repoPath = new RepoPath({ execFileAsync }) } = {})`;
  store `this._repoContext = repoContext` (`core/lib/commands/SafeBranch.js:23-31`).
- `run()` (was `run(repoPath)`, `SafeBranch.js:44`): read
  `const { repoPath } = this._repoContext`, keep
  `await this._repoPath.validate(repoPath)`, then `return this.checkout()`.
- `checkout()` (was `checkout(repoPath)`, `SafeBranch.js:62`): read
  `const { repoPath } = this._repoContext`; the dirty check, `git fetch -p`
  (`{ cwd: repoPath }`), and `this._repoConfig.getSafeBranch(repoPath)` bodies
  are otherwise unchanged. Output contract (`BRANCH=<branch>\n`) unchanged.
- Set `takesRepoContext: true` on `checkout-safe-branch`
  (`core/lib/core/commands.js:124`) and add it to the asserted list in
  `core/spec/lib/core/commands_spec.js:12-35`.

## ResolveAndFetch

- Constructor →
  `constructor(repoContext, { safeBranch = new SafeBranch(repoContext), githubIssue = new GithubIssue(repoContext) } = {})`;
  store `this._repoContext = repoContext`
  (`core/lib/commands/ResolveAndFetch.js:20-23`). Both default collaborators are
  now built from the injected context (`GithubIssue`'s optional `repoContext`
  param landed in step 01).
- `run(issuesFolder, argString)` (was `run(repoPath, issuesFolder, argString)`,
  `ResolveAndFetch.js:39`): read `const { repoPath } = this._repoContext` and
  use it for `IssueFile.findExisting(repoPath, issuesFolder, id)`
  (`:48`) and `this._githubIssue.fetch(repoPath, id)` (`:57`). The
  `safeBranch.checkout(repoPath)` call at `:40` becomes
  `this._safeBranch.checkout()` (no arg). No `RepoPath#validate` is added —
  `ResolveAndFetch` does not validate today.
- Set `takesRepoContext: true` on `resolve-and-fetch`
  (`core/lib/core/commands.js:146`) and add it to the assertion list.

## ArcanumSplitIssueFinish (already migrated in sub-issue 2 — ripple only)

- Where it builds `safeBranch = new SafeBranch()`
  (`core/lib/commands/ArcanumSplitIssueFinish.js:35`), pass the context:
  `safeBranch = new SafeBranch(this._repoContext)` (or thread it through the
  same way the class already threads `this._repoContext` to its other
  helpers).
- The call at `ArcanumSplitIssueFinish.js:80` becomes
  `this._safeBranch.checkout()` (no arg).

## Tests

- `core/spec/lib/commands/SafeBranch_spec.js` — construct
  `new SafeBranch(new RepoContext({ repoPath }), { execFileAsync, repoConfig, repoPath })`
  (or a `buildContext` fake wrapper) and call `run()` / `checkout()` with no
  argument. Update both the stubbed-collaborator describe block and the
  real-git-fixture block (`createGitFixtureRepo`).
- `core/spec/lib/commands/ResolveAndFetch_spec.js` — `buildResolveAndFetch`
  builds `new ResolveAndFetch(buildContext({ repoPath }), { safeBranch, githubIssue })`;
  `.run(...)` is called without a leading `repoPath`; the `safeBranch` stub's
  `checkout` spy is asserted to be called with no argument.
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — update the
  `SafeBranch` stub construction / `checkout` call-site expectations to the
  no-arg form.
- `core/spec/lib/core/commands_spec.js` — assertion list now includes
  `checkout-safe-branch` and `resolve-and-fetch`.

## Files to Change

- `core/lib/commands/SafeBranch.js`
- `core/lib/commands/ResolveAndFetch.js`
- `core/lib/commands/ArcanumSplitIssueFinish.js`
- `core/lib/core/commands.js` — flags on `checkout-safe-branch`,
  `resolve-and-fetch`
- `core/spec/lib/commands/SafeBranch_spec.js`
- `core/spec/lib/commands/ResolveAndFetch_spec.js`
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js`
- `core/spec/lib/core/commands_spec.js`
