# Node Plan: Refactor PrOperations

Main plan: [plan.md](plan.md)

## Steps

- [01 — GitBranch + Git facade](node/01-git-branch-and-facade.md)
- [02 — GitClient becomes context-bound](node/02-git-client-context.md)
- [03 — GitHubClient becomes context-bound](node/03-github-client-context.md)
- [04 — MergeBodyResolver absorbs repo/token](node/04-merge-body-resolver-context.md)
- [05 — PrOperations simplified](node/05-pr-operations-simplified.md)
- [06 — AutoFixAllGithub updated](node/06-auto-fix-all-github-update.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Execute the steps in this exact order — each one builds on the previous (`GitBranch`/`Git` have no breaking changes; `GitClient`/`GitHubClient`/`MergeBodyResolver` are each updated independently; `PrOperations` is the first class that actually wires all of them together; `AutoFixAllGithub` is last since it's the only other production consumer).
- No behavior/output change is expected anywhere in this plan — `core/spec/bin/autoFixAllGithubParity/{pr_number,pr_state,pr_merge}_spec.js` should keep passing unchanged throughout; use them as a regression signal if anything drifts.
- `@arcanum/core` is `"private": true` — no external consumers, no deprecation window needed.
