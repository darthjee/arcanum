# Extract PrOperations.js

Move `AutoFixAllGithub`'s PR-facing methods into a new `core/lib/utils/github/PrOperations.js` class: `prNumber`, `prState`, `prMerge`, `_findPr`, `_prStateLabel`, `_fetchPrCommits`, `_resolveMergeBody`, `_resolveMergerLogin`, `_deleteBranchRef`, `mergeBodyMode`, `_modelCoauthorOmitted`, `_currentBranch` (its only consumer). Move the corresponding logic verbatim — this is a relocation, not a rewrite; output must stay byte-identical.

`PrOperations` takes the same injectable collaborators `AutoFixAllGithub` currently builds for these methods (`origin`, `githubToken`, `fetchFn`, `timeoutMs`, plus whatever `ConfigChain`/`RepoConfig` dependency backs `mergeBodyMode`/`_modelCoauthorOmitted`), constructed the same way `IssueTagger`'s constructor already does (injectable, with real defaults).

Use `Origin.resolveWithRef()` (from step 02) wherever `AutoFixAllGithub._resolveRepo` was previously called for these methods.

## Files to Change

- `core/lib/utils/github/PrOperations.js` (new) — the moved methods and their JSDoc, constructor-injectable collaborators.
- `core/spec/lib/utils/github/PrOperations_spec.js` (new) — move the corresponding spec cases from `AutoFixAllGithub_spec.js`, unchanged in assertions/fixtures.

Leave `AutoFixAllGithub.js` itself untouched in this step (still holding its original copy of this logic) — removing the duplicated methods and wiring the facade to delegate happens together in step 05, so the repo stays in a buildable state after every step.
