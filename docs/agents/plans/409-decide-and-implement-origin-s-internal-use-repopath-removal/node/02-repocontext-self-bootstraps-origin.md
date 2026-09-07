# Self-bootstrap Origin in RepoContext

In `core/lib/context/RepoContext.js`, move `origin`'s construction from a bare
parameter default (`origin = new Origin()` at line 52) into the constructor
body, body-assigned and `??`-merged exactly like the existing
`githubToken`/`issueStateService`/`githubIssueService` lines (lines 62-65):

```js
this._origin = origin ?? new Origin({ repoContext: this, execFileAsync });
```

Drop `origin`'s parameter default in the destructured constructor signature (it
becomes a plain optional param, like `githubToken`), and update the constructor
JSDoc `@param {Origin} [deps.origin]` line to match the phrasing already used for
`githubToken`'s doc (defaults to a context-bound `Origin` when omitted, so
`resolve`/`resolveWithRef` can call it arg-free).

Simplify `#resolve`/`#resolveWithRef` (lines 86-96) to call `this._origin` with
no arguments instead of passing `this.repoPath` explicitly — safe because
`this._origin` is now always bound to this same `RepoContext` instance (or an
explicitly injected double) via the self-bootstrap above:

```js
async resolveWithRef() {
  return this._origin.resolveWithRef();
}

async resolve() {
  return this._origin.resolve();
}
```

## Files to Change

- `core/lib/context/RepoContext.js` — constructor: drop `origin`'s parameter default, add the body-assigned self-bootstrap line, update JSDoc; `#resolve`/`#resolveWithRef`: drop the `this.repoPath` argument from their `this._origin` calls.
