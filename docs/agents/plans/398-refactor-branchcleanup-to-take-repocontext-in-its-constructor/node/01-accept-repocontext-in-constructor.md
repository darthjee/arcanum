# Accept repoContext in the constructor

Additive, non-breaking phase. Give `BranchCleanup` an optional leading
positional `repoContext` parameter and let `cleanupBranch` fall back to
`repoContext.repoPath` when no explicit `repoPath` is passed. Both
calling styles work after this phase; no call-site changes.

## What to do

1. **Constructor.** Change
   `constructor({ execFileAsync = defaultExecFileAsync } = {})` to
   `constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {})`.
   Store `this._repoContext = repoContext`. `repoContext` is optional in
   this phase (undefined when constructed the old zero-arg way).

2. **`cleanupBranch(repoPath, id)`.** Keep the parameter list, but
   resolve the effective path as
   `const effectiveRepoPath = repoPath ?? this._repoContext?.repoPath;`
   at the top. Use `effectiveRepoPath` everywhere the method currently
   uses `repoPath` — the `if (!... || !id)` guard (keep the exact
   `Usage: github.sh cleanup-branch <repo_path> <id>` message) and all
   four `{ cwd: ... }` options. When `repoPath` is passed explicitly it
   still wins, so existing callers are unaffected.

3. **JSDoc.** Add a `@param` for the constructor's `repoContext`
   (optional; `cleanupBranch` reads `repoPath` off it when the argument
   is omitted). Leave the existing `@param {string} repoPath` on
   `cleanupBranch` but note it now falls back to the injected context.

4. **Spec — shared builder.** In `BranchCleanup_spec.js`, the
   `newBranchCleanup(overrides)` helper currently does
   `new BranchCleanup({ execFileAsync: fakeExecFileAsync(), ...overrides })`.
   Let it optionally pass a positional `repoContext`, e.g. accept a
   `repoContext` key in `overrides` and forward it:
   `new BranchCleanup(overrides.repoContext, { execFileAsync: fakeExecFileAsync(), ...rest })`.
   Existing calls that pass no `repoContext` must keep working
   unchanged.

5. **Spec — new coverage.** Add a `describe`/`context` block that
   constructs with `createRepoContextMock({ repoPath: '/fake/repo' })`
   (import from `../../../support/factories/repoContextFactory.js` —
   mirror the relative depth already used by
   `RepoConfig_spec.js`) and calls `cleanupBranch('5')` with **no**
   `repoPath` argument, asserting the same 4-command git sequence
   against `/fake/repo` that the existing
   "runs the remote delete, checkout, reset, and local delete, in order"
   test asserts. Add one case that an explicit `repoPath` argument still
   overrides the injected context. Leave every existing
   per-call-`repoPath` test untouched.

6. Run `make core-test` and `make core-lint`; both must be clean.

## Files to Change

- `core/lib/utils/git/BranchCleanup.js` — add optional positional
  `repoContext` to the constructor; `cleanupBranch` falls back to
  `this._repoContext?.repoPath`; JSDoc.
- `core/spec/lib/utils/git/BranchCleanup_spec.js` — extend the
  `newBranchCleanup` builder to forward a positional `repoContext`; add
  `createRepoContextMock`-based coverage for the no-`repoPath` calling
  style plus an explicit-override case.
