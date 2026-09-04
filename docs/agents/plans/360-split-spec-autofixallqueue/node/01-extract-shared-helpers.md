# Extract shared test helpers into a support factory

Create `core/spec/support/factories/autoFixAllQueue.js`, lifting the three local helpers
currently defined inline in `AutoFixAllQueue_spec.js` (`newQueue`, `writeQueueFile`,
`readQueueFile`), parameterized so they no longer close over the spec's outer-scope `dir`/
`queueFile` variables:

- `export function createAutoFixAllQueue(dir, overrides = {})` — the current `newQueue` body,
  with `dir` taken as an explicit first argument instead of an outer-scope closure. Keep the
  same default `overrides` shape (`repoPath = dir`, `origin` resolving `{ domain: 'github.com',
  repo: REPO, repoRef: REPO }`, `githubToken` resolving `TOKEN`, `fetchFn = fakeFetch()`) and the
  same `AutoFixAllQueue` construction (`lock: new Lock({ sleepMs: 5 })`,
  `repoContextFactory: new RepoContextFactory({ fetchFn })`, `pollIntervalMs: 5`,
  `sleepFn: async () => {}`, `...rest`).
- `export async function writeQueueFile(queueFile, entries)` — the current body unchanged
  aside from taking `queueFile` as an explicit argument instead of closing over it.
- `export async function readQueueFile(queueFile)` — same, `queueFile` explicit.
- `export const REPO = 'darthjee/arcanum';` and `export const TOKEN = 'fake-token';` — lifted
  from the original spec's top-level constants, since `createAutoFixAllQueue`'s defaults need
  them.

Follow the same import list and JSDoc-comment style as the `#347` precedent factory,
`core/spec/support/factories/autoFixAllGithub.js` (one `@param`/`@returns` block per exported
function) — JSDoc isn't lint-required under `spec/**/*.js` (`jsdoc/require-jsdoc` is off there),
but the existing factory sets the documented-helper convention this new one should match.

This step is additive only: `AutoFixAllQueue_spec.js` itself is not touched here — it keeps its
own inline helpers until step 05 deletes it wholesale, avoiding needless churn in a file with a
short remaining lifetime.

## Files to Change

- `core/spec/support/factories/autoFixAllQueue.js` (new) — `createAutoFixAllQueue`,
  `writeQueueFile`, `readQueueFile`, `REPO`, `TOKEN`.
