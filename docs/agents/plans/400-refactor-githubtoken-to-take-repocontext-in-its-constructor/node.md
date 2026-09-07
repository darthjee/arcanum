# node Plan: Refactor GithubToken to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Overview

`GithubToken.get(repoPath)` is threaded `repoPath` per call from two production sites:

- `context/RepoContext.js:93` — `this._githubToken.get(this.repoPath)`; the instance is a
  zero-arg constructor default, and `RepoContextFactory.js` builds one shared instance and
  forwards it into every `RepoContext`.
- `services/GithubIssueService.js:97` — `this._githubToken.get(repoPath)` inside the
  per-call `issueClient(repoPath)` helper.

Bring both `GithubToken` and `GithubIssueService` in line with the repo's other repo-scoped
collaborators (constructor-injected context) while keeping every existing zero-arg /
per-call-`repoPath` path working — the dual mode is **permanent** here, because
`GithubIssueService` is itself constructed zero-arg as a default collaborator inside
`RepoContext`'s and `GithubIssue`'s constructors (no context exists at that point), and
`GithubIssue#fetch(repoPath, id)` passes `repoPath` explicitly.

Layering: `GithubIssueService` (in `services/`) must not import `context/RepoContext.js`
(one-way `commands` → `context`/`services` → `utils`, lint-enforced against `commands/`
imports via `core/eslint.config.mjs`). The relaxation is limited to accepting a
caller-supplied, duck-typed `{ repoPath }` object **as a parameter** — no `import`, so the
import graph stays acyclic and the guardrail stays green — mirroring how
`GithubIssueService` already hands `IssueClient` a hand-built `{ resolveWithRef, getToken }`
context shape.

## Context

- Sibling refactors already merged with a clean required-`repoContext` shape:
  `QueueStore` (#407) and `RepoConfig` (#408). `GithubToken` cannot go that far because of
  the `services/` caller, hence the dual mode.
- `GithubToken` is stateless (holds only `execFileAsync`), so a per-`RepoContext` instance
  instead of one `RepoContextFactory`-shared instance has no meaningful cost.
- `commands/shared/GithubIssue.js` never calls `GithubToken#get` — it only constructs it
  zero-arg and forwards it into `GithubIssueService`. Its own wiring is left unchanged; the
  dual mode keeps it working. Passing `repoContext` down from `GithubIssue` is noted as a
  possible follow-up, not part of this issue.

## Steps

- [01 — GithubToken: accept repoContext](node/01-githubtoken-repocontext.md)
- [02 — GithubIssueService: accept a duck-typed context](node/02-githubissueservice-context.md)
- [03 — Migrate the RepoContext / RepoContextFactory wiring](node/03-repocontext-wiring.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`)

## Notes

- **Permanent dual mode.** Keep the per-call `repoPath` parameter on both
  `GithubToken#get` and `GithubIssueService#issueClient`/`#create` as an optional override
  — do not remove it in this issue. The zero-arg construction of `GithubIssueService`
  inside `RepoContext` (`RepoContext.js:47`) and `GithubIssue` (`GithubIssue.js:67`), plus
  `GithubIssue#fetch`'s explicit `repoPath`, mean there will always be a no-context caller.
- **Precedence rule:** when both are available, an explicitly passed `repoPath` argument
  wins over `this._repoContext.repoPath`. This matches `GithubIssue.js`'s existing dual
  mode and keeps every current spec (which passes `repoPath` explicitly) green untouched.
- **`RepoContextFactory` shared `githubToken` dep.** Once `RepoContext` builds its own
  `GithubToken`, the factory's shared instance is dead on the `build()` path. Drop the
  `githubToken` constructor param and the `githubToken: this._githubToken` line from
  `RepoContextFactory` if nothing else consumes it; update `RepoContextFactory_spec.js`
  accordingly. If removing it turns out to ripple further than expected, leave the param in
  place (harmless) and just stop forwarding it — note which was done.
- **`script-engine.md`.** Step 2 adds one carve-out sentence to the `services/` layering
  bullet. This is the only non-`core/` file touched; it is in scope per the issue.
- Run `make core-lint` after each step — the jsdoc plugin (`jsdoc/require-jsdoc`,
  `publicOnly`) will flag any new/changed public method or constructor whose JSDoc is
  missing or stale.
