# Update the spec

Drop the now-invalid per-call-`repoPath` coverage and keep only the `repoContext`-based
construction path, updated for the new `paths(id)` signature.

## Files to Change

- `core/spec/lib/utils/file/IssueStatePaths_spec.js` — delete the two top-level raw-`repoPath`
  test cases (`paths('/repo', '42')` and `paths('/repo', '7')`) and the "prefers an explicit
  repoPath over the constructor-injected repoContext" case (that behavior no longer exists).
  Keep the "when constructed with a repoContext" case, renamed to drop the "falls back"
  framing (there's no more fallback — it's now the only path), calling `.paths('42')` (no
  `repoPath` argument) via `createRepoContextMock`.
