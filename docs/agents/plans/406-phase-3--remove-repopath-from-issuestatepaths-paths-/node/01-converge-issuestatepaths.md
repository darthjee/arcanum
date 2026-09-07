# Converge IssueStatePaths's constructor and paths()

Change `IssueStatePaths` itself to its finished Phase-3 shape: a bare, required
`repoContext` at construction (no destructured deps object, no default), and a `paths(id)`
method that resolves `repoPath` unconditionally from `this._repoContext.repoPath` — no
`repoPath` argument, no `??` fallback. Update the class-level and method-level JSDoc to
match: drop every `@param {string} [repoPath]` entry, and document `repoContext` as the
constructor's sole required parameter.

## Files to Change

- `core/lib/utils/file/IssueStatePaths.js` — change
  `constructor({ repoContext } = {})` to `constructor(repoContext) { this._repoContext =
  repoContext; }`; change `paths(repoPath, id)` to `paths(id)`, computing `base` as
  `this._repoContext.repoPath` directly; update both JSDoc blocks.
