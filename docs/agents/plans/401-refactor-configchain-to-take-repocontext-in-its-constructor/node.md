# Node Plan: Refactor ConfigChain to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Accept repoContext in ConfigChain's constructor, with a repoPath fallback in #read

`core/lib/utils/config/ConfigChain.js`'s constructor currently only accepts `{ env =
process.env }`. Extend it to also accept an optional `repoContext`, stored as
`this._repoContext`, alongside the existing `this._env`. In `#read(repoPath, namespace,
...keys)`, resolve the effective repo path as `repoPath ?? this._repoContext?.repoPath`
and pass that resolved value into `#_tierFiles(...)` instead of the raw `repoPath`
parameter — do **not** unconditionally overwrite `repoPath` the way `GithubIssue.js`'s
`#info`/`#create` do, since those exist to support a CLI entrypoint that strips a leading
positional; `ConfigChain` has no such entrypoint, so the fallback must only kick in when
the caller omits `repoPath` (falsy/`undefined`), leaving explicit per-call `repoPath` (the
`RepoContext.js` zero-arg-construction path) untouched. Update the class-level and
`#read`'s JSDoc to document the new constructor param and the fallback behavior, and mark
`repoPath` as optional (`[repoPath]`) in `#read`'s `@param`.

### Step 2 — Add spec coverage for the repoContext-constructed path

In `core/spec/lib/utils/config/ConfigChain_spec.js`, add coverage that constructs
`ConfigChain` with a `repoContext` (via `createRepoContextMock` from
`core/spec/support/factories/repoContextFactory.js`, passing the spec's existing
`repoPath` temp dir) and calls `#read` **without** a `repoPath` argument (i.e.
`configChain.read(undefined, namespace, key)` or shifted so `namespace` occupies the first
positional — match whichever reads more naturally against the existing `newConfigChain()`
helper's call sites), asserting it resolves values from the `repoContext`-supplied repo
path's tier files exactly like the existing per-call-`repoPath` cases. Also add a case
confirming an explicit per-call `repoPath` still wins over a constructor-injected
`repoContext` when both are present (dual-mode transition guarantee). Leave every existing
per-call-`repoPath` spec case untouched — they cover `ConfigChain`'s continued zero-arg
use from `RepoContext.js`.

## Files to Change

- `core/lib/utils/config/ConfigChain.js` — constructor accepts optional `repoContext`;
  `#read` falls back to `repoContext.repoPath` when `repoPath` is omitted; JSDoc updated.
- `core/spec/lib/utils/config/ConfigChain_spec.js` — new spec cases for the
  `repoContext`-constructed path and the explicit-`repoPath`-wins case, reusing
  `createRepoContextMock`.

## Notes

- No call site migrates in this issue — `RepoContext.js` keeps building `ConfigChain`
  zero-arg internally (there's no `RepoContext` yet at that point to inject), and there is
  no external caller today that would switch to the `repoContext`-constructed style.
- Dropping `repoPath` from `#read`'s signature entirely is explicitly out of scope here
  (deferred to a later phase, per the issue) — `RepoContext.js`'s zero-arg internal
  construction must keep working, so `repoPath` cannot be removed as a parameter.
- Verify with `make core-test` and `make core-lint` before considering this done.
