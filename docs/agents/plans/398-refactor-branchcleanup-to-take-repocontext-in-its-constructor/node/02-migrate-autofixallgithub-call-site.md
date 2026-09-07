# Migrate the AutoFixAllGithub call site

Depends on step 01. Still non-breaking for `BranchCleanup` (the
per-call `repoPath` fallback stays in place until step 03). Switch
`AutoFixAllGithub` to construct `BranchCleanup` with its `repoContext`
and stop passing `repoContext.repoPath` per call.

## What to do

1. **Move the default construction into the constructor body.** In
   `core/lib/commands/auto-fix-all/AutoFixAllGithub.js`, the deps
   destructuring currently ends with `branchCleanup = new BranchCleanup()`
   — a default parameter, so it cannot see `this._repoContext`. Change
   the deps entry to bare `branchCleanup` (no default), and in the
   constructor body, after `this._repoContext = repoContext;`, set:
   `this._branchCleanup = branchCleanup ?? new BranchCleanup(this._repoContext);`

2. **Drop the per-call `repoPath`.** In `AutoFixAllGithub#cleanupBranch`
   (around `AutoFixAllGithub.js:143`), change
   `return this._branchCleanup.cleanupBranch(this._repoContext.repoPath, id);`
   to `return this._branchCleanup.cleanupBranch(id);` — relying on the
   step-01 fallback. `AutoFixAllGithub#cleanupBranch(id)`'s own
   signature is unchanged.

3. **JSDoc.** Update the `@param {BranchCleanup} [deps.branchCleanup]`
   note if its wording implies a pre-built zero-arg default.

4. **Spec factory.** In `core/spec/support/factories/autoFixAllGithub.js`
   (line ~120), change `branchCleanup: new BranchCleanup({ execFileAsync })`
   to `branchCleanup: new BranchCleanup(repoContext, { execFileAsync })`
   so the injected collaborator carries the same context the production
   path now uses. `repoContext` is already built locally in that factory
   (line ~116).

5. **Specs.** Confirm `AutoFixAllGithubPrAndBranch_spec.js`'s
   `#cleanupBranch` block still passes:
   - "rejects when repoPath or id is missing" — `createAutoFixAllGithub({ repoPath: '' })`
     then `github.cleanupBranch()`; the rejection now comes from the
     step-01 guard seeing an empty effective `repoPath` (from the
     context) and/or missing `id`. It should still reject with the same
     `Usage:` message; adjust the assertion only if the message differs.
   - "resolves ... `github.cleanupBranch('5')`" — unchanged.
   No new test files; update expectations in place only if a message or
   call shape actually changed.

6. Run `make core-test` and `make core-lint`; both must be clean.

## Files to Change

- `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` — construct
  `new BranchCleanup(this._repoContext)` in the constructor body;
  `cleanupBranch(id)` forwards only `id`; JSDoc.
- `core/spec/support/factories/autoFixAllGithub.js` — pass `repoContext`
  when building the injected `BranchCleanup`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubPrAndBranch_spec.js`
  — adjust `#cleanupBranch` expectations only if a message/call shape
  changed.
