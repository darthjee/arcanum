# node Plan: Decide and implement Origin's internal-use repoPath removal

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add repoContext to Origin's constructor](node/01-origin-accepts-repocontext.md)
- [02 — Self-bootstrap Origin in RepoContext](node/02-repocontext-self-bootstraps-origin.md)
- [03 — Drop the shared origin from RepoContextFactory](node/03-repocontextfactory-drops-shared-origin.md)
- [04 — Update specs for the new Origin/RepoContext/RepoContextFactory behavior](node/04-update-specs.md)

## CI Checks

- `core`: `make core-test` (CI job: `test`)
- `core`: `make core-lint` (CI job: `checks`)

## Notes

- This issue absorbs #399's Phase 1 (`Origin` accepting `repoContext`) — #399 itself
  is still open and unimplemented as of this plan; #399 can be closed as
  superseded once this issue ships, since its scope is fully covered here.
- `repoPath` is **not** removed from `Origin#resolve`/`resolveWithRef` — it remains
  a permanent, documented per-call override, per the issue's "Solution" decision
  (Option 1). Do not attempt full removal (Option 2) in this plan.
- `GithubIssueService.js` (`core/lib/services/GithubIssueService.js`) is a third
  direct caller of `Origin#resolve`/`resolveWithRef` with its own separate
  duck-typed `repoPath` override — explicitly out of scope per the issue, leave
  it untouched.
- `RepoContext#resolve`/`#resolveWithRef` (`core/lib/context/RepoContext.js:86-96`)
  currently pass `this.repoPath` explicitly to `this._origin.resolve`/
  `resolveWithRef`. Since `this._origin` is now always self-bootstrapped bound to
  the same `RepoContext` instance (`this._repoContext.repoPath === this.repoPath`
  by construction) unless a caller explicitly injects a different `origin` double,
  simplifying these two wrappers to call arg-free is safe and consistent with how
  `#getToken` already calls `this._githubToken.get()` zero-arg.
