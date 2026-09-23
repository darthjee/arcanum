# Add GitHubTransport
Create `core/lib/utils/github/GitHubTransport.js`, the single home for GitHub connection mechanics. Nothing uses it yet in this step, so it lands with full spec coverage and no behavior change.

Suggested shape (adjust names if lint or conventions suggest better ones, but keep it this small):

- `constructor({ context, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS })`. Owns `DEFAULT_TIMEOUT_MS = 30000`, `API_URL = 'https://api.github.com'`, `GRAPHQL_URL = 'https://api.github.com/graphql'`.
- `async repo()` → `this._context.resolveWithRef()` (returns `{ repo, repoRef, ... }`). Domain methods need `repo`/`repoRef` for both paths and error messages, so they call this explicitly.
- `async request(path, { method = 'GET', body, failure })` → resolves the token, calls `fetchFn(API_URL + path, { method?, headers, body?, signal: AbortSignal.timeout(timeoutMs) })`, and returns the response. It adds `Authorization: Bearer <token>` always, and `Content-Type: application/json` + `JSON.stringify(body)` only when `body` is given. A rejected fetch or a non-OK response throws `failure()`. Only include `method` in the init when it is not the GET default, so existing `toHaveBeenCalledWith` expectations (which omit `method` for GETs) keep matching.
- `async requestJson(path, opts)` → `request` + `response.json()`. A parse failure throws `failure()`.
- `async requestArray(path, opts)` → `requestJson`, returning `[]` when the body is not an array.
- `async graphql(query, variables, { failure })` → POST to `GRAPHQL_URL` with the same headers and timeout. A rejected fetch, non-OK response, unparseable JSON, or non-empty `errors` array throws `failure()`. Returns the parsed payload.
- `async bestEffort(fn)` → awaits `fn()` and swallows any error, including token or repo resolution failures, which the current `deleteBranch`/`_mutateReaction` also swallow.

Match the JSDoc density and style of the surrounding `core/lib/utils/github/` classes.

Add `core/spec/lib/utils/github/GitHubTransport_spec.js`, using `createRepoContextMock` like `GitHubClient_spec.js`. Cover:

- URL building
- the auth header, and `Content-Type`/body only when a body is given
- `signal` presence (timeout configuration)
- success, non-OK, and rejected fetch for `request`
- malformed JSON for `requestJson`
- array normalization for `requestArray`
- GraphQL success, non-OK, rejected fetch, and `errors` handling
- `bestEffort` swallowing both a rejection and a context-resolution failure

## Files to Change
- `core/lib/utils/github/GitHubTransport.js` — new transport class.
- `core/spec/lib/utils/github/GitHubTransport_spec.js` — new unit specs.
