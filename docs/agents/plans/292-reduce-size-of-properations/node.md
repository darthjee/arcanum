# node Plan: reduce size of PrOperations

Main plan: [plan.md](plan.md)

## Steps

- [01 — Create RepoContext + spec + helper](node/01-create-repocontext.md)
- [02 — Create GitClient + spec](node/02-create-gitclient.md)
- [03 — Create GitHubClient + spec](node/03-create-githubclient.md)
- [04 — Create MergeBodyResolver + spec](node/04-create-mergebodyresolver.md)
- [05 — Refactor PrOperations into a facade + parity spec](node/05-refactor-properations.md)
- [06 — Adjust AutoFixAllGithub to create RepoContext per-call](node/06-adjust-autofixallgithub.md)
- [07 — Validate AutoFixAllWaitCiAndMerge](node/07-validate-autofixallwaitciandmerge.md)

## CI Checks

- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn test` (CI job: `test`)

## Notes

- Each step is a green commit — new files created in steps 1–4 are not imported by anything until step 6, so `yarn test`/`yarn lint` stay green at every intermediate commit.
- No spec file exists for `PrOperations` today — the parity spec in step 05 must be written from scratch by characterizing current behavior (read `PrOperations.js` directly for exact error messages/edge cases before extracting), not inferred from the new class shapes alone.
- Zero new runtime dependencies — every new class uses only Node built-in APIs (`fetch`, `execFile`, `promisify`).
- `RepoContext` lands at `core/lib/context/RepoContext.js` — a new top-level `core/lib/` subfolder alongside the existing `commands/` and `utils/`, not nested under `utils/` (matches `commands/`'s existing precedent of sitting beside `utils/` rather than inside it). `GitClient`, by contrast, joins the existing `core/lib/utils/git/` folder next to `Origin.js` — no new top-level folder for it.
- See the issue's "Alternatives Considered" section for why `RepoContext` (not a bare `Context`, `LocalContext`, or `RepoSession`) was chosen, and why the shared-context wrapper was kept instead of each class re-declaring `origin`/`githubToken`/`issueState`/`configChain` individually.
