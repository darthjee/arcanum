# Extract shared spec helpers into a factory module

Create `core/spec/support/factories/autoFixAllReplyComment.js`, following the same shape as
the existing `core/spec/support/factories/autoFixAllWaitCi.js` and
`core/spec/support/factories/autoFixAllQueue.js` factories: named exports, each with a JSDoc
comment, plus any constants the helpers close over exported too so each of the three split
specs (steps 02–04) can import them directly.

Move these four helpers out of `AutoFixAllReplyComment_spec.js` (lines 1–89 today) verbatim,
converting each from a local function declaration to a named export:

- `fakeReadFile(content = DEFAULT_TEMPLATE)` — unchanged body; export `DEFAULT_TEMPLATE` and
  `TEMPLATE_PATH` (built from `resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`)
  as constants alongside it, since the fake closes over both.
- `fakeExecFileAsync({ prNumber, resolveFails, pushFails, branch } = {})` — unchanged body.
- `stubDeps(overrides = {})` — unchanged body; it calls the two fakes above with their
  defaults.
- `newContext(repoPathValue)` — today this closes over the outer `describe`'s `repoPath` via a
  default parameter (`repoPathValue = repoPath`). Parameterize it to take `repoPath` as a
  **required** explicit argument instead (no default), so it works standalone in each of the
  three split files, each of which keeps its own `beforeEach`/`afterEach` temp-dir setup. Every
  call site across the three new specs must then pass `repoPath` explicitly:
  `newContext(repoPath)` instead of the current bare `newContext()`.

Also move the shared constants used across scenario blocks — `USAGE`, `ID`, `AGENT`,
`MODEL_NAME`, `MODEL_EMAIL`, `REPLY_BODY` — into the same module as named exports, so all three
split specs import identical values rather than redeclaring them.

No jasmine config change needed: support modules are imported directly by specs
(`helpers: []` in `core/spec/support/jasmine.json` or equivalent — verify, don't assume).

## Files to Change

- `core/spec/support/factories/autoFixAllReplyComment.js` — new file; named exports
  `fakeReadFile`, `fakeExecFileAsync`, `stubDeps`, `newContext`, and constants `DEFAULT_TEMPLATE`,
  `TEMPLATE_PATH`, `USAGE`, `ID`, `AGENT`, `MODEL_NAME`, `MODEL_EMAIL`, `REPLY_BODY`.
