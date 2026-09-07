# Remove repoPath from cleanupBranch

Depends on steps 01 and 02. Breaking cleanup — must land last. After
this phase `repoContext` is the only source of `repoPath` and is
required at construction.

## What to do

1. **Method signature.** In `core/lib/utils/git/BranchCleanup.js`,
   change `cleanupBranch(repoPath, id)` to `cleanupBranch(id)`. Drop the
   step-01 fallback line; read `const { repoPath } = this._repoContext;`
   instead.

2. **Guard.** Replace `if (!repoPath || !id)` with a check that keeps
   the existing behavior of the callers' specs: reject when `id` is
   missing, and also when `this._repoContext?.repoPath` is falsy (this
   preserves `AutoFixAllGithubPrAndBranch_spec.js`'s "rejects when
   repoPath or id is missing" case, which drives an empty context
   `repoPath`). Keep the `Usage: github.sh cleanup-branch <repo_path>
   <id>` message verbatim — it names the unchanged shell command.

3. **JSDoc.** Drop the `@param {string} repoPath ...` line on
   `cleanupBranch`. Make the constructor's `@param` state `repoContext`
   is now required and is the sole source of `repoPath`. Update the
   `@returns` / prose only where they still mention a `repoPath`
   argument.

4. **Spec — `BranchCleanup_spec.js`.**
   - Drop the now-invalid per-call-`repoPath` cases: every
     `cleanupBranch(REPO_PATH, '5')` call becomes `cleanupBranch('5')`
     with the path supplied via
     `createRepoContextMock({ repoPath: '/fake/repo' })` at construction
     (fold these into / keep them alongside the block added in step 01).
   - "rejects when repoPath or id is missing" becomes "rejects when id
     is missing" — construct with a valid `repoContext`, call
     `cleanupBranch()` with no `id`, assert the same `Usage:` message.
     Optionally add a "rejects when the context has no repoPath" case.
   - Remove the now-unused `REPO_PATH` constant if nothing references it.
   - The stdout-forwarding, remote-delete-tolerance, and
     checkout-failure cases stay — only their construction/first
     argument changes.

5. **Spec — `autoFixAllGithub.js` factory.** Already updated in step 02
   to `new BranchCleanup(repoContext, { execFileAsync })`; no change
   needed here, but verify it still constructs correctly now that
   `repoContext` is mandatory.

6. Grep the repo for any other `new BranchCleanup(` or `.cleanupBranch(`
   usage to confirm `AutoFixAllGithub.js` + specs are the only callers
   before removing the fallback.

7. Run `make core-test` and `make core-lint`; both must be clean.

## Files to Change

- `core/lib/utils/git/BranchCleanup.js` — `cleanupBranch(id)`; read
  `repoPath` from `this._repoContext`; `id`-plus-context guard; JSDoc
  (drop `@param repoPath`, mark `repoContext` required).
- `core/spec/lib/utils/git/BranchCleanup_spec.js` — drop per-call
  `repoPath` cases; all construction via `createRepoContextMock`;
  rework the missing-argument case; remove the unused `REPO_PATH`
  constant if orphaned.
