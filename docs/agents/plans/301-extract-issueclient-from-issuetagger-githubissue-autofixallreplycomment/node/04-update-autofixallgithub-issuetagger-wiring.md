# Update AutoFixAllGithub's IssueTagger wiring

`AutoFixAllGithub.js` currently default-constructs one shared `issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs })` in its own constructor, and its `hasShipitLabel(repoPath, id)`/`_mutateTag(repoPath, id, tag, action)` methods resolve `repo`/`token` themselves before passing them into `this._issueTagger.hasLabel(id, repo, token, 'shipit')`/`.fetchLabels(id, repo, token)`/`.addLabel(id, repo, token, label)`/`.removeLabel(id, repo, token, label)`.

After [Step 02](02-convert-issuetagger.md), `IssueTagger` no longer takes `repo`/`token` as method params and can't be a constructor-level shared singleton (it needs a `RepoContext`, and `repoPath` varies call to call). Update:

- Drop the constructor-level `issueTagger` default; add a private `_issueTagger(repoPath)` helper mirroring the existing `_prOperations(repoPath)` helper — builds a per-call `RepoContext` (reuse the same one `_prOperations(repoPath)` builds, or build a sibling one from the same shared `origin`/`githubToken`/`fetchFn`/`timeoutMs`) plus a fresh `IssueTagger({ context, issueClient })`.
- `hasShipitLabel`: replace `const { repo } = ...; const token = ...; hasShipit = await this._issueTagger.hasLabel(id, repo, token, 'shipit')` with `hasShipit = await this._issueTagger(repoPath).hasLabel(id, 'shipit')`.
- `_mutateTag`: replace the `fetchLabels(id, repo, token)`/`addLabel(id, repo, token, label)`/`removeLabel(id, repo, token, label)` calls with `this._issueTagger(repoPath).fetchLabels(id)`/`.addLabel(id, label)`/`.removeLabel(id, label)`. `repoRef` (still needed for this method's own error messages) keeps coming from `this._origin.resolveWithRef(repoPath)` as today.
- Keep the constructor's `issueTagger` deps option for test overrides, but as an override for the *per-call builder* (a factory), not a pre-built instance — check how `_prOperations(repoPath)`'s own constructor-level overrides (`gitClient`, `githubClient`, etc.) are exposed for testing and mirror that shape.

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — replace the constructor-level `issueTagger` singleton with a per-call `_issueTagger(repoPath)` builder; update `hasShipitLabel`/`_mutateTag` call sites.
- `core/spec/commands/AutoFixAllGithub_spec.js` — update mocks for the per-call `issueTagger` construction; assertions on `hasShipitLabel`/`addTag`/`removeTag` output should need no changes.
