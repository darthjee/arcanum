# Migrate ArcanumSplitIssueFinish

Uses `repoPath` for `RepoPath#validate`, the `arcanum-split-issue/scripts/github.sh`
`execFile` shellout (both the script path and the `mark-split` args), the
`SafeBranch#checkout` call, and `_deleteWorkingFiles`. `SafeBranch` is not
migrated in this issue — it keeps `checkout(repoPath)` and is fed
`this._repoContext.repoPath`.

## What to do

1. `core/lib/commands/ArcanumSplitIssueFinish.js`:
   - Constructor → `constructor(repoContext, { execFileAsync = defaultExecFileAsync,
     safeBranch = new SafeBranch(), readdir: readdirFn = readdir, unlink:
     unlinkFn = unlink, repoPathValidator = new RepoPath() } = {})`. Store
     `this._repoContext = repoContext`; keep `this._execFileAsync`,
     `this._safeBranch`, `this._readdir`, `this._unlink`; rename `this._repoPath`
     → `this._repoPathValidator`.
   - `run(issueId)` — drop the leading `repoPath` parameter.
   - Presence guard → `if (!this._repoContext.repoPath || !issueId) throw new
     Error(USAGE)` (USAGE unchanged).
   - `await this._repoPathValidator.validate(this._repoContext.repoPath)`.
   - `execFile` call: use `this._repoContext.repoPath` in both
     `path.join(<repoPath>, 'arcanum-split-issue', 'scripts', 'github.sh')` and
     the `['mark-split', <repoPath>, issueId]` args array.
   - `const branch = await this._safeBranch.checkout(this._repoContext.repoPath)`.
   - `_deleteWorkingFiles(issueId)` — drop its `repoPath` param, read
     `this._repoContext.repoPath` internally for the `path.join(..., ISSUES_DIR)`
     calls. Keep the two-pass dash-then-underscore ordering exactly.
   - Update class + method JSDoc.

2. `core/lib/core/commands.js` — `takesRepoContext: true` on
   `'arcanum-split-issue-finish'`.

3. `core/spec/lib/core/commands_spec.js` — grow the `takesRepoContext`
   assertion to include `arcanum-split-issue-finish` (keep registry order).

4. `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js`:
   - `stubDeps()` → rename the `repoPath` key to `repoPathValidator` (it already
     also stubs `execFileAsync` and `safeBranch`).
   - Construct as `new ArcanumSplitIssueFinish({ repoPath: <tempDir> },
     stubDeps(...))`.
   - `instance.run(repoPath, ISSUE_ID)` → `instance.run(ISSUE_ID)`; the
     missing-repoPath case constructs with `{ repoPath: '' }`.
   - Assertions on `deps.execFileAsync` / `deps.safeBranch.checkout` call
     arguments: the `repoPath` they receive is now the `{ repoPath }` literal's
     value — unchanged in practice since the spec passes the same temp dir.
   - No expected-output / stdout assertions change.

## Files to Change

- `core/lib/commands/ArcanumSplitIssueFinish.js` — constructor takes `repoContext`; `run` / `_deleteWorkingFiles` drop `repoPath`; `github.sh` shellout, `SafeBranch#checkout`, and file paths read `this._repoContext.repoPath`; `_repoPath` dep renamed `_repoPathValidator`.
- `core/lib/core/commands.js` — `takesRepoContext: true` on `arcanum-split-issue-finish`.
- `core/spec/lib/core/commands_spec.js` — grow the `takesRepoContext` assertion.
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` — construct with `{ repoPath }` literal + renamed deps; drop `repoPath` from `run(...)` calls.
