# Add repo-scoped helpers to GitHubTransport

Add three additive methods to `GitHubTransport`, mirroring the existing `request`/`requestJson`/`requestArray`:

```js
async repoRequest(pathFn, { method, body, message }) { ... }
async repoRequestJson(pathFn, opts) { ... }
async repoRequestArray(pathFn, opts) { ... }
```

- `pathFn(ids)` and `message(ids)` both receive the full resolved identity from `this.repo()` (`{ repo, repoRef, ... }`), not just the `repo` string.
- Call `this.repo()` first and **do not** catch/map its rejection — `origin` resolution errors must reach the caller unmapped, exactly as today.
- Build the failure lazily: `const failure = () => new Error(message(ids));` and delegate to the corresponding existing method with `{ method, body, failure }`. `message` must not be invoked on success.
- Existing methods (`repo`, `request`, `requestJson`, `requestArray`, `graphql`, `bestEffort`) are untouched.
- Update the class JSDoc to mention the helpers and the usage rule: use a repo-scoped helper when the only repo-dependent parts of a method are its path and failure message; methods with post-response validation keep calling `repo()` plus the base methods.

Add specs in `GitHubTransport_spec.js` (reuse its existing `newTransport` helper), one `describe` per helper (or a shared table where the three behave identically, to avoid duplication):
- `pathFn`/`message` receive the resolved identity (assert `repoRef` is available too).
- The built path is requested with the given `method`/`body`.
- A non-ok response / rejected fetch / unparseable JSON rejects with `message(ids)`.
- A rejected `resolveWithRef` propagates unmapped (the original error, not `message`).
- `message` is not called on success (spy).
- `repoRequestArray` normalizes a non-array body to `[]`.

## Files to Change
- `core/lib/utils/github/GitHubTransport.js` — add `repoRequest`, `repoRequestJson`, `repoRequestArray` + JSDoc.
- `core/spec/lib/utils/github/GitHubTransport_spec.js` — specs for the three helpers.
