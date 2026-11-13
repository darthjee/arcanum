# Node Plan: Return to the safe branch whenever a run does not continue to the next step

Main plan: [plan.md](plan.md)

## Shared contracts

Implement the `auto_next.sh <repo_path> <id>` flow and stdout forms from [plan.md](plan.md#shared-contracts) in `AutoPlanIssueAutoNext`, byte for byte with the shell twin:

- Mark-ready in-process through `GithubIssueMark#markReady(id)` (`core/lib/commands/shared/GithubIssueMark.js`), with its `IssueTagger` output redirected to stderr (inject a tagger, or a stdout writer, whose writes go to `this._stderr`). `READY=true` when it resolves, `false` when it throws.
- Release in-process through `SafeBranch#checkout()` (`core/lib/commands/shared/SafeBranch.js`). On success, write `BRANCH=<branch>\n` to stderr and set `RELEASED=true`. On a thrown error (dirty tree, fetch failure), write the message to stderr and set `RELEASED=false`.

## Steps

- [01 — Extend AutoPlanIssueAutoNext](node/01-extend-auto-next.md)
- [02 — Unit specs](node/02-unit-specs.md)
- [03 — Parity and engine-dispatch specs](node/03-parity-specs.md)

## CI Checks

- `core/`: `make core-lint` and `make core-test` (CI jobs `checks` and `test`).

## Notes

- Keep the injectable-deps style: add `githubIssueMark` and `safeBranch` constructor deps, defaulting to real instances built from `repoContext`.
- Check what `SafeBranch` writes during `checkout()`. Anything that reaches stdout breaks parity.
