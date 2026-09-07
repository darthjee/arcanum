# node Plan: Phase 3: Remove repoPath from IssueStatePaths#paths()

Main plan: [plan.md](plan.md)

## Steps

- [01 — Converge IssueStatePaths's constructor and paths()](node/01-converge-issuestatepaths.md)
- [02 — Update the three callers](node/02-update-callers.md)
- [03 — Update the spec](node/03-update-spec.md)

## CI Checks

- `core/`: `make core-test` (CI job: core test suite)
- `core/`: `make core-lint` (CI job: core lint)

## Notes

- Phase 2 (#405) is already merged onto `main` — every caller already holds a
  `repoContext`/`context` object at construction time, so this phase is pure cleanup with
  no new context to thread in.
- Out of scope: any other repoPath-per-call utility (companion issues #395, #396, #398,
  #399, #400, #401, #402), and `GithubIssue.js`'s own remaining per-method `repoPath`
  fallback on `.info()`/`.create()`.
