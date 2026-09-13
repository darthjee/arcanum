# Issue: Reduce cyclomatic complexity of fakeGithubApiFetchPreload.js's github-mode fetch mock (Lizard: 20 vs limit 15)

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

Verified via `lizard -l javascript -C 15` on the file: `github` mode (lines 165-226) is
the **only** mode over the limit (CCN 20). The other modes are already comfortably
under 15 (`wait-ci`: 8, `queue`: 6, `wait-ci-and-merge`: 11, `auto-fix-issue-github`: 12,
`monitor-pr`: 10) simply because they have fewer branches — none of them uses a
dispatch-table or extracted-helper pattern today; every mode in this file is a plain
`if`/`else if` chain. The closest existing `{matcher, handler}`-style precedent in the
codebase is `fakeExecFileAsync(handlers)` in
`core/spec/support/factories/arcanumUpdateRunUpdate.js:60-74` (`handlers.find((candidate)
=> candidate.match(file, args))`, used to mock `execFileAsync`/`git` calls) — a different
mechanism, but structurally the nearest thing to mirror.

## What needs to be done

- Refactor the `github` mode branch of `fakeGithubApiFetchPreload.js` (lines roughly
  141-226) so the fetch mock's cyclomatic complexity drops to 15 or below, without
  changing any externally observable behavior (same responses, same status codes, same
  env-var-driven configuration via `FAKE_FETCH_*`).
- Model the refactor on `fakeExecFileAsync`'s matcher-array approach (see Context): an
  ordered array of `{ match(url, options), handler(url, options) }` entries, evaluated
  in sequence via `.find()`, with the top-level `fetch` implementation reduced to
  finding the first matching entry and invoking its handler (falling back to the
  existing 404 response when none match). This preserves the current match-in-order
  semantics the if-chain relies on while moving each endpoint's own logic out of the
  single function body.
- Scope is limited to `github` mode: it is the only mode currently over the complexity
  limit. Applying the same dispatch-table style to the other modes for stylistic
  consistency is optional and out of scope unless explicitly requested.
- Preserve the mock's existing comments describing which real modules/calls each branch
  drives, updating them only as needed to match the refactored structure — including the
  inline Codacy XSS-false-positive comment on `html_url: prUrl` (lines 177-184,
  referencing issue #461), which must stay attached to that branch if it's extracted.
- Carefully preserve these behavioral edge cases during refactor:
  - `rawUrl` is normalized to a string once (`url = ... .toString()`) — keep a single
    conversion rather than re-deriving per handler.
  - Several branches rely on `options.method === undefined` meaning "GET" (notably the
    issue-view branch, and implicitly `/pulls?head=` / `/pulls/\d+/commits`, which don't
    gate on method at all).
  - Route order/specificity matters: the anchored regex `/\/issues\/[^/]+$/` must keep
    distinguishing issue-view (GET) from issue-labels mutation (`.../issues/<id>/labels`)
    — a table-based refactor must preserve that anchoring, not just substring-match
    `/issues/`.
  - `DELETE` is shared by two mutually exclusive URL shapes (`/git/refs/heads/` vs.
    `/labels`) and must remain distinguished by URL, not just by method.
  - Exact status codes/bodies (e.g. `404` fallback `{ message: 'not found' }`, `204`
    empty body for ref delete, `422`/`405` failure codes) must be byte-identical
    post-refactor, since this mock backs shell/native parity specs.
- Re-run the specs that exercise `github` mode (and the shell/native parity specs, if
  any depend on this file) to confirm behavior is unchanged after the refactor.

## Acceptance criteria

- [ ] Lizard reports the `github`-mode fetch mock's cyclomatic complexity at or below 15.
- [ ] No behavioral change to any `FAKE_FETCH_*`-driven response, status code, or routing
      decision in `github` mode.
- [ ] All existing specs relying on `fakeGithubApiFetchPreload.js`'s `github` mode
      continue to pass.
