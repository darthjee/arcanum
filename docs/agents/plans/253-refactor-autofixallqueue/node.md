# Node Plan: Refactor AutoFixAllQueue

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract QueueStore](node/01-extract-queuestore.md)
- [02 — Extract IssueTagger](node/02-extract-issuetagger.md)
- [03 — Refactor AutoFixAllQueue to delegate](node/03-refactor-autofixallqueue.md)
- [04 — Split and isolate the tests](node/04-split-tests.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- Pure internal decomposition: `AutoFixAllQueue`'s public API (`save`, `next`, `waitNext`, `push`, `pop`, `empty`, `list`) and its exact stdout/stderr output must stay identical — verified by keeping `AutoFixAllQueue_spec.js` as an unmodified-behavior integration test.
- `IssueTagger` must NOT be prefixed `AutoFixAll` — it follows the existing generic-module convention (`Lock.js`, `Origin.js`, `GithubToken.js`) so other skills can reuse it later.
- `QueueStore` has no GitHub or lock dependency; `AutoFixAllQueue` keeps owning the lock acquire → read → write → release sequence itself, since that transaction spans two `QueueStore` calls.
- Other existing specs (e.g. `AutoFixAllGithub_spec.js`) already define their own local `fakeFetch`. Migrating them onto the new shared `core/spec/support/` version is optional cleanup, out of scope for this issue.
