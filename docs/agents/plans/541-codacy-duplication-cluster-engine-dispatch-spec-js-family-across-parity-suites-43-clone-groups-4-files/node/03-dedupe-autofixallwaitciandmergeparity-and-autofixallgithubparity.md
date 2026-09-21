# Dedupe autoFixAllWaitCiAndMergeParity and extract autoFixAllGithubParity's own helper

Finish the family: bring the third GitHub-fixture-based file onto the shared example, and give the structurally different fourth file its own smaller, separate extraction rather than folding it into the shared harness.

- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`: keep its existing `seedLocalState(repo, { engine: { mode } })` call from `autoFixAllWaitCiAndMergeParitySetup.js` unchanged (it's a working, differently-named equivalent of `seedEngineMode`, not part of this file's own duplication). Replace its `'engine_dispatch routing (via the real wait_ci_and_merge.sh shim)'` `describe` block with a single `itRoutesEngineDispatch(...)` call from step 01/02's shared example, passing `seedLocalState` (bound to `{ engine: { mode } }`) as this case's seed step inside `prepare` — `itRoutesEngineDispatch` must not hard-code a call to `seedEngineMode` itself; it should let each `prepare` callback do its own engine-mode seeding (via either `seedEngineMode` or `seedLocalState`), matching what step 01 designs.
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`: extract its own inline `seedEngineMode(repoDir, mode)` (the plain-directory-taking variant) into `core/spec/support/fixtures/engineDispatchFixtures.js`, alongside the existing `buildDispatchFixtures` helper it already imports from there — do not put it in `core/spec/support/utils/engineMode.js` from step 01, since that one's signature takes a repo object, not a plain directory, and this file has no GitHub/PR fixture to share with the other three. Update the spec to import the extracted helper instead of defining it inline. Leave the rest of this file (the throwaway wrapper script, `buildDispatchFixtures`, its two `it`s) as-is — it is not a candidate for the shared `itRoutesEngineDispatch` example.
- Run `make core-test` and `make core-lint` after both files change, and `make core-report` to confirm the duplication score for this family actually drops.

## Files to Change

- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js` — replace its scaffolding with a single `itRoutesEngineDispatch(...)` call, keeping `seedLocalState` as its seed step.
- `core/spec/support/fixtures/engineDispatchFixtures.js` — add the extracted `seedEngineMode(repoDir, mode)` (plain-directory variant) alongside `buildDispatchFixtures`.
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` — drop its inline `seedEngineMode`, import the extracted one instead.
