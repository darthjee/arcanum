# GithubToken: accept repoContext

Extend `GithubToken`'s constructor to also accept an optional `repoContext` alongside the
existing `execFileAsync` dep, and let `get()` fall back to it.

## What to do

- Constructor: `constructor({ execFileAsync = defaultExecFileAsync, repoContext } = {})` —
  store `this._repoContext = repoContext`. Update the constructor JSDoc with a
  `@param {import('../../context/RepoContext.js').default} [deps.repoContext]` line.
  A type-only `import(...)` in a JSDoc comment is erased at runtime and does **not** create
  a module edge or violate the layering guardrail (the lint rule only bars runtime imports
  matching `**/commands/**`); `utils/GithubToken.js` referencing `context/` in a type
  annotation is consistent with `QueueStore`/`RepoConfig`, which already do exactly this.
- `get(repoPath)`: keep the parameter, but resolve the effective path as
  `const path = repoPath ?? this._repoContext?.repoPath;` at the top. An explicitly passed
  `repoPath` wins over the context. Thread that resolved value into `_switchGhUser` /
  `_getGhUser` as today. Update the method JSDoc to mark `repoPath` optional and document
  the fallback.
- No behavior change when `repoPath` is passed — every existing caller and spec keeps
  working unchanged.

## Spec

Add to `core/spec/lib/utils/github/GithubToken_spec.js` a new context under `#get` that
constructs `new GithubToken({ execFileAsync: execFileSpy, repoContext: { repoPath: '/repo' } })`
and calls `githubToken.get()` with **no argument**, asserting:

- the `git config user.ghuser` call is made with `{ cwd: '/repo' }` (assert on the options
  arg the `execFileAsync` spy received for the `['config', 'user.ghuser']` call), and
- the resolved token is returned.

Add one case asserting an explicit `get('/other')` argument overrides the constructor
`repoContext.repoPath` (the `git config` call uses `cwd: '/other'`). Leave the five
existing per-call-`repoPath` cases untouched.

## Files to Change

- `core/lib/utils/github/GithubToken.js` — optional `repoContext` constructor param;
  `get()` falls back to `this._repoContext?.repoPath`; JSDoc.
- `core/spec/lib/utils/github/GithubToken_spec.js` — new `repoContext`-constructed cases
  plus an explicit-arg-wins case.
