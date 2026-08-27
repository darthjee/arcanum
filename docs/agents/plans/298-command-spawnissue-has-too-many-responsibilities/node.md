# node Plan: Command SpawnIssue has too many responsibilities

Main plan: [plan.md](plan.md)

## Shared contracts

`SpawnIssue` must read `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` via `RepoContext#readConfig`, defaulting to `5`/`5` when absent at every tier — the shell counterpart (`scripter`'s `spawn_issue_shell.sh`) reads the same namespace/keys with the same fallback via `config_chain_read`, so both paths behave identically for any given repo.

## Steps

- [01 — Add createIssue to RepoContext](node/01-add-createissue-to-repocontext.md)
- [02 — Extract LabelApplicator](node/02-extract-labelapplicator.md)
- [03 — Extract IssueLinker](node/03-extract-issuelinker.md)
- [04 — Refactor SpawnIssue to per-call RepoContext](node/04-refactor-spawnissue.md)
- [05 — Remove unused RepoConfig.getPlanIssuesRetryConfig](node/05-remove-repoconfig-retry-config.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `ConfigChain.js` itself needs no code change — it's already fully generic (`ConfigChain#read` returns the raw resolved value or `undefined`, with no built-in per-key defaults). Every existing consumer applies its own default/validation after calling `readConfig` (see `MergeBodyResolver#resolveMode`'s `'empty'` fallback) — `SpawnIssue` follows the same pattern for `max-retry-count`/`error-sleep-time`, reusing `RepoConfig#_numberOrDefault`'s coercion logic (accept a number or numeric string, fall back to the default otherwise) inline or as a small private helper.
- Confirmed via `IssueStateService`/`GithubIssue`/`AutoFixAllGithub` precedent: `RepoContext` is always built fresh per call from the CLI-supplied `repoPath` — `core/bin/arcanum` always does a zero-arg `new ModuleClass()` before calling `.run(repoPath, ...)`, so `repoPath` is never available at construction time.
