# Update specs for the new Origin/RepoContext/RepoContextFactory behavior

Cover the changes from steps 01-03 and keep the existing suites passing:

- `core/spec/lib/utils/git/Origin_spec.js` — add coverage for the new
  `repoContext` fallback: constructing `new Origin({ execFileAsync, repoContext:
  { repoPath: '/repo' } })` and calling `resolve()`/`resolveWithRef()` with no
  argument resolves using `repoContext.repoPath`; an explicitly passed `repoPath`
  still wins over an injected `repoContext`. Existing cases that call
  `origin.resolve('/repo')`/`resolveWithRef('/repo')` with an explicit path and
  no `repoContext` stay unchanged.
- `core/spec/lib/context/RepoContext_spec.js` — update the two assertions that
  currently expect `origin.resolve`/`resolveWithRef` to be called
  `toHaveBeenCalledWith(REPO_PATH)` (lines 28 and 40) to
  `toHaveBeenCalledWith()` (no args), matching step 02's simplification. Add a
  case asserting `RepoContext` self-builds a real `Origin` bound to itself when
  `origin` is omitted from the constructor (mirroring the existing
  `#getToken`/self-built-`GithubToken` coverage further down this file), e.g.
  asserting `context._origin` is an `Origin` instance whose `_repoContext` is
  the context itself.
- `core/spec/lib/context/RepoContextFactory_spec.js` — remove the now-dead
  `origin` override from `newFactory()`'s defaults (lines 12-15) and from the
  standalone factory built at lines 98-101, since `RepoContextFactory` no longer
  accepts an `origin` param at all; `buildFromContext`'s own `newContext()`
  helper (lines 117-126) keeps its `origin` double as-is, since that's
  `RepoContext`'s own constructor, unaffected by step 03. Add a case asserting
  `build()`'s returned context self-builds its own `Origin` bound to itself
  (mirroring the existing self-built-`GithubToken` case at lines 41-46).

## Files to Change

- `core/spec/lib/utils/git/Origin_spec.js` — add `repoContext`-fallback and explicit-`repoPath`-wins coverage.
- `core/spec/lib/context/RepoContext_spec.js` — update the two `origin.resolve`/`resolveWithRef` call-arg assertions to zero-arg; add self-built-`Origin` coverage.
- `core/spec/lib/context/RepoContextFactory_spec.js` — drop the dead `origin` factory overrides; add a self-built-`Origin`-per-context case under `#build`.
