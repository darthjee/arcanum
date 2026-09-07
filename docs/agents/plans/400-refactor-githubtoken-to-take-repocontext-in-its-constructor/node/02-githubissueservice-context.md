# GithubIssueService: accept a duck-typed context

Add an optional `repoContext` constructor parameter to `GithubIssueService`, typed as a
plain `{ repoPath }` shape with **no `import` of `context/RepoContext.js`**, forward it into
the `GithubToken` it constructs, and let `issueClient()` / `create()` read `repoPath` from
it when the explicit argument is absent.

## What to do

- Constructor: add `repoContext` to the destructured deps. Store `this._repoContext`.
  When building the default `GithubToken`, forward it:
  `githubToken = new GithubToken({ repoContext })`. (Leave `origin`'s per-call `repoPath`
  alone — `Origin`'s own migration is a separate companion issue; only pass `repoContext`
  into `Origin` too if `Origin` already accepts it by the time this is implemented,
  otherwise leave `Origin` untouched.)
  JSDoc the new param as `@param {{repoPath: string}} [deps.repoContext]` — a structural
  type, **not** `import('...RepoContext.js')`, to keep even the type reference free of a
  `context/` edge and make the "duck-typed, not the real class" intent explicit.
- `issueClient(repoPath)`: keep the parameter; resolve
  `const path = repoPath ?? this._repoContext?.repoPath;` and use it for both
  `resolveWithRef` and `getToken` in the hand-built context object. Because the constructed
  `GithubToken` now already carries the same `repoContext`, `getToken` may call
  `this._githubToken.get()` with no argument on the context path — but passing the resolved
  `path` explicitly is equivalent and keeps the two branches uniform; pick one and keep it
  consistent with `resolveWithRef`.
- `create(repoPath, title, file)`: resolve the same
  `repoPath ?? this._repoContext?.repoPath` at the top for the `origin.resolve` /
  `issueClient` / `mkdir` / `writeFile` calls. Explicit argument still wins.
- Update the class header comment: the "it never builds a `RepoContext` itself" sentence
  stays true (it still doesn't), but note it now optionally accepts a caller-supplied
  `{ repoPath }` context object.

## script-engine.md carve-out

In `docs/agents/architecture/script-engine.md`, extend the `services/` layering bullet
(currently "`services/` — … May depend on `utils/`.") with a sentence:

> A `services/` module may additionally accept a caller-supplied, context-shaped
> `{ repoPath }` object as a constructor/method parameter (duck-typed, never
> `import`ed from `context/`) — this keeps the import graph one-way while letting a
> service stop threading `repoPath` per call.

Do not change the "Nothing under `context/`, `services/`, or `utils/` may import from
`commands/`" paragraph or the eslint config — the guardrail is unchanged, only the prose
rule around parameters is clarified.

## Spec

In `core/spec/lib/services/GithubIssueService_spec.js`:

- `#issueClient`: add a case constructing
  `new GithubIssueService({ origin, githubToken, fetchFn, repoContext: { repoPath: '/fake/repo' } })`
  and calling `service.issueClient()` with **no argument**, asserting `origin.resolveWithRef`
  and `githubToken.get` resolve against `/fake/repo` (same assertions as the existing
  explicit-`repoPath` case, which stays).
- `#create`: add a case constructing with `repoContext: { repoPath }` (the temp dir) and
  calling `service.create(undefined, title, file)` — or a dedicated no-`repoPath` overload
  if cleaner — asserting the issue file is written under that repo path.
- Add one explicit-arg-wins case for either method.

## Files to Change

- `core/lib/services/GithubIssueService.js` — optional duck-typed `repoContext` constructor
  param; forward into `GithubToken`; `issueClient()`/`create()` fall back to
  `this._repoContext?.repoPath`; header comment + JSDoc.
- `core/spec/lib/services/GithubIssueService_spec.js` — `repoContext`-constructed cases for
  `#issueClient` and `#create`, plus an explicit-arg-wins case.
- `docs/agents/architecture/script-engine.md` — one carve-out sentence on the `services/`
  layering bullet.
