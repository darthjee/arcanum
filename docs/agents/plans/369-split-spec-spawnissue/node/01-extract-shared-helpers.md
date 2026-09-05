# Extract shared helpers into a factory module

Create `core/spec/support/factories/spawnIssue.js` and move into it, verbatim (same
behavior, JSDoc preserved), the 2 helpers and 4 constants currently inlined at the top of
`core/spec/lib/commands/shared/SpawnIssue_spec.js` (lines 1–51):

- Constants: `REPO_REF` (`'darthjee/arcanum'`), `DOMAIN` (`'github.com'`), `CREATE_OUTPUT`
  (the `ID=42\n...` fixture string), `USAGE` (the spawn-issue usage string).
- `stubDeps(overrides)` — returns the default `{ sleepFn, labelApplicator, issueLinker }`
  spy set merged with `overrides`; unchanged.
- `buildContext(repoPath, opts)` — assembles a real `RepoContext` wrapping fake
  `origin`/`configChain`/`repoPathValidator`/`githubIssue` collaborators. **One required
  signature change**: the current inline version defaults `opts.repoPath` to the describe
  block's closure variable `let repoPath` (`{ repoPath: contextRepoPath = repoPath, ... } =
  {}`), which is not available once the helper moves to a separate module. Change the
  signature to take the per-test `repoPath` as an explicit first argument —
  `buildContext(repoPath, { origin, configChain, githubIssue } = {})` — with no fallback
  default. Every call site (steps 02–04) passes its current test's `repoPath` variable (or,
  for the one validation test that needs an empty path, the literal `''`) explicitly as the
  first argument. This preserves identical behavior/values at every call site; only the
  mechanism for supplying `repoPath` changes from an implicit closure default to an explicit
  argument.

Export `stubDeps`, `buildContext`, `REPO_REF`, `DOMAIN`, `CREATE_OUTPUT`, `USAGE` as named
exports.

## Files to Change

- `core/spec/support/factories/spawnIssue.js` — new file; content as described above, copied
  from `core/spec/lib/commands/shared/SpawnIssue_spec.js` lines 1–51, with `buildContext`'s
  signature adjusted as described.
