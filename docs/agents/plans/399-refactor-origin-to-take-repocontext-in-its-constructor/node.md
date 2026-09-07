# Plan: Refactor Origin to take repoContext in its constructor

Issue: [399-refactor-origin-to-take-repocontext-in-its-constructor.md](../../issues/399-refactor-origin-to-take-repocontext-in-its-constructor.md)

## Overview

`Origin` currently takes `repoPath` as an explicit argument on both its public methods
(`resolve`, `resolveWithRef`), even though its only external caller (`GithubIssue.js`)
already holds a `repoContext` and just unpacks `repoContext.repoPath` at the call site. This
plan gives `Origin` an optional constructor-injected `repoContext`, falling back to the
existing per-call `repoPath` when absent, and migrates `GithubIssue.js` to the new shape.
`RepoContext`/`RepoContextFactory`'s zero-arg internal construction of `Origin` is
unaffected — it's structurally required to keep working, since no `RepoContext` instance
exists yet at that point. Fully dropping `repoPath` from `Origin`'s internal-use path is out
of scope here, tracked separately in #409.

## Context

- `Origin` (`core/lib/utils/git/Origin.js`) has no constructor today beyond `{ execFileAsync }`.
- `context/RepoContext.js` and `context/RepoContextFactory.js` both build it zero-arg
  (`origin = new Origin()`) as a default constructor parameter, before any `RepoContext`
  instance exists.
- `commands/shared/GithubIssue.js` already takes `repoContext` in its own constructor
  (`this._repoContext`) but still constructs `new Origin()` zero-arg and passes
  `repoContext.repoPath` explicitly into `resolve`/`resolveWithRef` at each call site
  (`core/lib/commands/shared/GithubIssue.js:91` and `:137`).
- `GithubIssue`'s own dual-mode constructor (optional `repoContext`, methods falling back to
  an explicit `repoPath` positional when absent) is the precedent this plan mirrors for
  `Origin`.

## Implementation Steps

### Step 1 — Accept repoContext in Origin's constructor

- Extend `Origin`'s constructor to accept an optional `repoContext` alongside the existing
  `execFileAsync` dep, stored as `this._repoContext`.
- `resolve(repoPath)` and `resolveWithRef(repoPath)` keep their `repoPath` parameter, but
  fall back to `this._repoContext?.repoPath` when `repoPath` isn't passed explicitly
  (mirroring `GithubIssue.js`'s existing `if (this._repoContext) { repoPath = ... }` shape).
  Both calling styles must keep working — `RepoContext`/`RepoContextFactory`'s zero-arg
  internal construction is unaffected.
- Update the class-level and method JSDoc to document the new `repoContext` param and the
  fallback behavior.
- Add spec coverage in `core/spec/lib/utils/git/Origin_spec.js`: construct with a
  `repoContext` (reuse `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js`) and call `resolve`/`resolveWithRef`
  with no `repoPath` argument, asserting the mock's `repoPath` is used. Leave the existing
  per-call-`repoPath` spec cases untouched.

### Step 2 — Migrate GithubIssue.js to the new constructor shape

- In `GithubIssue.js`'s constructor, change the `origin` default from `new Origin()` to
  `new Origin({ repoContext: this._repoContext })` — but only meaningful when `GithubIssue`
  itself was constructed with a `repoContext`; when it wasn't (`repoContext` is `undefined`),
  this still yields a `new Origin({ repoContext: undefined })`, functionally identical to
  today's zero-arg `new Origin()`, so no branching is needed at the `origin` default itself.
- Remove the explicit `repoContext.repoPath` argument from the two call sites
  (`core/lib/commands/shared/GithubIssue.js:91` and `:137`) that currently pass it to
  `this._origin.resolve(repoPath)` — only for the branch where `this._repoContext` is set;
  the zero-arg/explicit-`repoPath`-positional path (used by the CLI entrypoints without a
  `repoContext`) is unaffected and keeps passing `repoPath` through as today.
- Update `core/spec/lib/commands/shared/GithubIssueInfo_spec.js` and
  `GithubIssueFetch_spec.js`/`GithubIssueCreate_spec.js` as needed if any spec asserts on the
  exact arguments passed to a mocked `origin.resolve`.

## Files to Change

- `core/lib/utils/git/Origin.js` — add `repoContext` to the constructor; `resolve`/
  `resolveWithRef` fall back to `this._repoContext.repoPath`.
- `core/spec/lib/utils/git/Origin_spec.js` — add `repoContext`-constructed coverage.
- `core/lib/commands/shared/GithubIssue.js` — construct `Origin` with `repoContext`; stop
  passing `repoContext.repoPath` explicitly at its two `resolve`/`resolveWithRef` call sites.
- `core/spec/lib/commands/shared/GithubIssueInfo_spec.js`,
  `core/spec/lib/commands/shared/GithubIssueFetch_spec.js`,
  `core/spec/lib/commands/shared/GithubIssueCreate_spec.js` — update any assertions on the
  arguments passed to `origin.resolve`/`resolveWithRef`, if affected.

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- `RepoContext.js`/`RepoContextFactory.js` are not touched by this plan — their zero-arg
  `new Origin()` construction keeps working unchanged via the fallback in Step 1.
- Fully removing `repoPath` from `Origin`'s internal-use path (so `RepoContext`/
  `RepoContextFactory` no longer need the fallback at all) is deferred to #409.
