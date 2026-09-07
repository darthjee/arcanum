# Migrate the three call sites to repoContext construction

The issue's **Phase 2**. Every call site already holds a `repoContext` at its own layer.
Switch each to construct `new IssueFile(repoContext)` and stop threading `repoPath` into
`findExisting`. The Phase-1 fallback added in Step 01 is what makes this safe with no
change to `IssueFile.js` itself in this step.

## What to do

- `core/lib/commands/shared/ResolveAndFetch.js` — change the `deps` default from
  `issueFile = new IssueFile()` to `issueFile = new IssueFile(repoContext)` (matches how
  `safeBranch` / `githubIssue` are already built from `repoContext` in the same
  destructuring). In `run()`, keep `findExisting`'s current 3-arg shape but pass
  `undefined` for `repoPath` (`this._issueFile.findExisting(undefined, issuesFolder,
  id)`) — the parameter is not removed until Step 03. `titleFromFilename(existing)` is
  unchanged.
- `core/lib/commands/shared/ResolvePlanPaths.js` — in `run()`, change
  `const issueFile = new IssueFile();` to `const issueFile = new IssueFile(this._repoContext);`
  and call `issueFile.findExisting(undefined, issuesFolder, id)`.
- `core/lib/commands/shared/ResolveIdAndFile.js` — in `run()`, change
  `const issueFile = new IssueFile();` to `const issueFile = new IssueFile(this._repoContext);`;
  update the `_resolveA` / `_resolveC` `findExisting` calls to pass `undefined` for
  `repoPath` (`issueFile.findExisting(undefined, issuesFolder, id)`). The `repoPath`
  locals those helpers still receive are only used elsewhere (e.g. building `file` guesses)
  and stay.
- No change to `core/lib/utils/file/IssueFile.js` in this step.

## Spec

- `core/spec/lib/commands/shared/ResolveAndFetch_spec.js`,
  `core/spec/lib/commands/shared/ResolvePlanPaths_spec.js`,
  `core/spec/lib/commands/shared/ResolveIdAndFile_spec.js` — if any of these inject a fake
  `issueFile` or assert on the arguments `findExisting` is called with, update those
  expectations to the `undefined` first arg / `repoContext`-constructed form. If they only
  drive the real collaborator against a temp repo (via a real/mock `repoContext`), they
  should pass unchanged — run them to confirm.
- `core/spec/lib/utils/file/IssueFile_spec.js` — no change in this step.

## Files to Change

- `core/lib/commands/shared/ResolveAndFetch.js` — `new IssueFile(repoContext)` via `deps`;
  `findExisting(undefined, issuesFolder, id)`.
- `core/lib/commands/shared/ResolvePlanPaths.js` — `new IssueFile(this._repoContext)`;
  `findExisting(undefined, issuesFolder, id)`.
- `core/lib/commands/shared/ResolveIdAndFile.js` — `new IssueFile(this._repoContext)`;
  `findExisting(undefined, issuesFolder, id)` in `_resolveA` / `_resolveC`.
- `core/spec/lib/commands/shared/ResolveAndFetch_spec.js`,
  `core/spec/lib/commands/shared/ResolvePlanPaths_spec.js`,
  `core/spec/lib/commands/shared/ResolveIdAndFile_spec.js` — only if they assert on
  `findExisting` args or inject a fake; otherwise unchanged.
