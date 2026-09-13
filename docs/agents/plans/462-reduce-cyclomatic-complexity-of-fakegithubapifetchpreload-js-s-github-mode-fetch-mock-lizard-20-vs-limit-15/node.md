# Node Plan: Reduce cyclomatic complexity of fakeGithubApiFetchPreload.js's github-mode fetch mock (Lizard: 20 vs limit 15)

Main plan: [plan.md](plan.md)

## Overview

Refactor the `github`-mode branch (`core/spec/support/utils/fakeGithubApiFetchPreload.js`,
currently lines ~141-226) so the fetch mock's cyclomatic complexity drops from 20 to 15
or below, with zero externally observable behavior change.

## Context

- Verified via `lizard -l javascript -C 15` on the file: `github` mode (function body at
  lines 165-226) is the **only** mode over the limit (CCN 20). The other modes (`wait-ci`:
  8, `queue`: 6, `wait-ci-and-merge`: 11, `auto-fix-issue-github`: 12, `monitor-pr`: 10)
  are already comfortably under 15 — none of them uses a dispatch-table pattern today;
  every mode in this file is a plain `if`/`else if` chain. Do not touch them.
- There is no dispatch-table pattern already applied anywhere in this file. The nearest
  existing precedent in the codebase is `fakeExecFileAsync(handlers)` in
  `core/spec/support/factories/arcanumUpdateRunUpdate.js:60-74`:
  ```js
  export function fakeExecFileAsync(handlers) {
    return jasmine.createSpy('execFileAsync').and.callFake(async (file, args = []) => {
      const handler = handlers.find((candidate) => candidate.match(file, args));

      if (!handler) {
        throw new Error(`unexpected execFileAsync call: ${file} ${JSON.stringify(args)}`);
      }

      if (handler.error) {
        throw handler.error;
      }

      return { stdout: handler.stdout };
    });
  }
  ```
  It mocks a different mechanism (`execFileAsync`/`git`, not `fetch`), but the
  ordered-matcher-array-plus-`.find()` shape is what this refactor should mirror.
- Lizard is not configured/run locally in this repo (no hit in `core/package.json`,
  `core/eslint.config.mjs`, root `Makefile`, or `.circleci/config.yml`) — it runs
  externally (Codacy). Verify the complexity reduction with a local, throwaway
  `npx lizard -l javascript -C 15 core/spec/support/utils/fakeGithubApiFetchPreload.js`
  run rather than any repo script.

## Implementation Steps

### Step 1 — Extract github-mode routing into an ordered matcher array

In the `else if (mode === 'github')` block, keep the existing env-var reads (lines
152-163, e.g. `prNumber`, `prTitle`, `prUrl`, `prState`, `prMerged`, `prCommitsJson`,
`userLogin`, `userFail`, `mergeFail`, `labels`, `issueViewFail`, `issueEditFail`)
unchanged, then replace the current `if`/`else if` chain (lines 165-226) with:

- A `url = typeof rawUrl === 'string' ? rawUrl : rawUrl.toString();` normalization kept
  exactly as-is, done once before dispatch.
- An ordered array of entries, each `{ match: (url, options) => boolean, handler: (url, options) => Response }`,
  built once per mode-activation (so handlers still close over the env-var-derived
  consts above) and evaluated in the **same order** the current if-chain checks them —
  order matters because some matchers would otherwise overlap:
  1. `/pulls?head=` (`url.includes(...)`, no method gate) → existing PR-lookup response
     (empty array when `!prNumber`, otherwise the full PR object with `html_url: prUrl`
     — keep the inline Codacy XSS-false-positive comment, issue #461, attached to this
     handler).
  2. `/\/pulls\/\d+\/commits/` (regex, no `$` anchor, no method gate) → `prCommitsJson`
     response.
  3. `PUT` + `/\/pulls\/\d+\/merge$/` (method **and** anchored regex) → merge response
     (`mergeFail` → 405, else 200).
  4. Exact `url === 'https://api.github.com/user'` (no method gate) → merger-login
     response (`userFail` → 404, else `{ login: userLogin }`).
  5. `DELETE` + `url.includes('/git/refs/heads/')` (method and substring) → 204 empty
     body.
  6. `options.method === undefined` + `/\/issues\/[^/]+$/` (method-undefined-as-GET
     **and** anchored regex — the anchor is what stops this from matching
     `.../issues/<id>/labels`) → issue-view response (`issueViewFail` → 404, else
     `{ labels: labels.map((name) => ({ name })) }`).
  7. `(POST or DELETE)` + `url.includes('/labels')` → issue-labels mutation response
     (`issueEditFail` → 422, else 200).
  - Fallback: when no entry matches, return the existing
    `new Response(JSON.stringify({ message: 'not found' }), { status: 404 })`.
- Top-level `globalThis.fetch` for this mode becomes: normalize `url`, `.find()` the
  first matching entry, call its `handler(url, options)` if found, else the 404
  fallback.
- Preserve every existing comment describing which real module/call each branch drives
  (the block comment above the mode, lines 142-151, and the inline Codacy comment on
  `html_url`), relocating them to sit with their corresponding matcher/handler entry.
- Do not change `wait-ci`, `queue`, `wait-ci-and-merge`, `auto-fix-issue-github`, or
  `monitor-pr` mode — out of scope (none exceeds the complexity limit).

### Step 2 — Verify complexity and behavior are unchanged

- Run `npx lizard -l javascript -C 15 core/spec/support/utils/fakeGithubApiFetchPreload.js`
  (from `core/`, or pass the full path) and confirm the `github`-mode function is now at
  or below CCN 15, and that no other function in the file regressed above 15.
- Run the full spec suite (`yarn test` from `core/`) and specifically confirm every spec
  that sets `ARCANUM_TEST_FAKE_FETCH=github` (search `core/spec` for that env var, e.g.
  specs covering `AutoFixAllGithub.js`) still passes unchanged — same status codes,
  same response bodies, same routing decisions for every `FAKE_FETCH_*` combination.
- Run `yarn lint` from `core/` to confirm the refactor doesn't introduce lint violations.

## Files to Change

- `core/spec/support/utils/fakeGithubApiFetchPreload.js` — replace the `github`-mode
  `if`/`else if` chain with an ordered `{ match, handler }` array + `.find()` dispatch,
  no behavior change.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Lizard's 15-CCN limit is enforced externally (Codacy), not by any repo-local script —
  use `npx lizard` locally only to self-verify before opening the PR; it isn't wired
  into `yarn test`/`yarn lint`.
- Scope is deliberately limited to `github` mode. Refactoring the other modes to the
  same matcher-array style for consistency was considered and explicitly deferred (see
  issue discussion) — out of scope for this issue.
