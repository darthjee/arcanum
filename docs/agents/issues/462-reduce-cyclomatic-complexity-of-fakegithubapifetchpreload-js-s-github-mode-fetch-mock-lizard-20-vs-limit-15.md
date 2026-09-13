# Reduce cyclomatic complexity of fakeGithubApiFetchPreload.js's github-mode fetch mock (Lizard: 20 vs limit 15)

## Context

`core/spec/support/utils/fakeGithubApiFetchPreload.js` is the preload module that
monkey-patches the global `fetch` in specs so no real network call ever leaves the
process, per the repo-wide "no real network calls in specs" rule. It supports several
modes selected via `ARCANUM_TEST_FAKE_FETCH`, each installing its own `globalThis.fetch`
implementation.

The `github` mode's fetch mock — the block driving every REST call
`AutoFixAllGithub.js` makes (PR lookup, PR commits, merger login, merge, branch delete,
and the issue-labels GET/POST/DELETE trio) — implements all of these branches as a
single async arrow function with a long chain of `if` statements. Lizard reports a
cyclomatic complexity of 20 for this function, against the repo's limit of 15, because
each endpoint/method combination it recognizes adds another branch to the same function
body.

## What needs to be done

- Refactor the `github` mode branch of `fakeGithubApiFetchPreload.js` (lines roughly
  135-213) so the fetch mock's cyclomatic complexity drops to 15 or below, without
  changing any externally observable behavior (same responses, same status codes, same
  env-var-driven configuration via `FAKE_FETCH_*`).
- A natural approach is extracting the URL/method routing into a table of
  `{ matcher, handler }` entries (or splitting per-endpoint logic into small helper
  functions closed over the mode's env-var-derived config), so the top-level `fetch`
  implementation just iterates the table/dispatches to a handler instead of holding
  every branch inline. This can reuse or mirror any pattern already used to keep the
  other modes (`wait-ci`, `queue`, `wait-ci-and-merge`, `auto-fix-issue-github`,
  `monitor-pr`) under the same complexity limit, for consistency across the file.
- Preserve the mock's existing comments describing which real modules/calls each branch
  drives, updating them only as needed to match the refactored structure.
- Re-run the specs that exercise `github` mode (and the shell/native parity specs, if
  any depend on this file) to confirm behavior is unchanged after the refactor.

## Acceptance criteria

- [ ] Lizard reports the `github`-mode fetch mock's cyclomatic complexity at or below 15.
- [ ] No behavioral change to any `FAKE_FETCH_*`-driven response, status code, or routing
      decision in `github` mode.
- [ ] All existing specs relying on `fakeGithubApiFetchPreload.js`'s `github` mode
      continue to pass.
