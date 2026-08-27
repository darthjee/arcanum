# Node Plan: Refactor AutoFixAllWaitCi

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add GitHubClient.getPrHeadSha() and getCheckRuns()](node/01-githubclient-methods.md)
- [02 — Add PrOperations.headSha() and checkRuns()](node/02-properations-methods.md)
- [03 — Add SafeFetcher utility](node/03-safefetcher.md)
- [04 — Add PrChecker service](node/04-prchecker-service.md)
- [05 — Slim AutoFixAllWaitCi down to orchestration](node/05-slim-autofixallwaitci.md)
- [06 — Update AutoFixAllWaitCi_spec.js mocks](node/06-update-command-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `PrOperations#prNumber()` returns a numeric string with a trailing `\n` (and may resolve from a cached `pr_id` — see `PrOperations.js`'s existing implementation), matching its use as a CLI-output value elsewhere (e.g. `AutoFixAllGithub#prNumber`). `AutoFixAllWaitCi.run()` must `trim()`/`Number()`-coerce it before passing it to `PrChecker#pollOnce`, since the poll loop needs a numeric PR number, not CLI-formatted text.
- `SafeFetcher` is deliberately speculative reuse (issue's own callout): today `PrChecker` is its only caller. Keep it generic (`run(fn)`) rather than PR-specific, but do not go looking for other call sites to migrate onto it as part of this issue.
- The "trusts a cached `pr_id`" behavior of `prNumber()` is an accepted, pre-existing behavior change from the current always-live `_resolvePrNumber` — see the issue's "Edge case considered" section. No special-casing needed; use `prNumber()` as-is.
- `core/spec/bin/autoFixAllWaitCiParity_spec.js` (shell vs. native parity) must stay green throughout — stdout and exit code must not change at any step. Run it after Step 5 and again after Step 6.
- Out of scope (per the issue): `auto-fix-all/scripts/wait_ci_shell.sh`, any other existing `GitHubClient` methods, and the issue-domain `fetch` duplication already handled in #301 (merged via #302).
