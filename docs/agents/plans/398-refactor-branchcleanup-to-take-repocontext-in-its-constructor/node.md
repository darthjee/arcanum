# node Plan: Refactor BranchCleanup to take repoContext in its constructor

Main plan: [plan.md](plan.md)

## Overview

`BranchCleanup` (`core/lib/utils/git/BranchCleanup.js`) exposes one
public method, `cleanupBranch(repoPath, id)`, and its constructor today
accepts only `{ execFileAsync }`. Its sole production caller,
`core/lib/commands/auto-fix-all/AutoFixAllGithub.js`, already holds a
`repoContext` and threads `repoContext.repoPath` into every
`cleanupBranch` call.

This plan moves `repoPath` off the method signature and onto the
constructor, via a `repoContext` parameter — the same end state already
shipped for `QueueStore` (#395) and `RepoConfig` (#396), but reached
here through a **phased, backward-compatible migration** (a deliberate
choice recorded on the issue) so each phase is an independently
green PR. The transitional dual mode mirrors the precedent in
`core/lib/commands/shared/GithubIssue.js` (optional leading positional
`repoContext` alongside a `{ ...deps } = {}` object, with a per-call
`repoPath` fallback).

## Context

- Target constructor shape: `constructor(repoContext, { execFileAsync } = {})`
  — `repoContext` positional, `execFileAsync` staying in the deps
  object. This matches `GithubIssue.js` rather than folding everything
  into one options object.
- `repoContext` is `core/lib/context/RepoContext.js`; specs build it via
  `createRepoContextMock` from
  `core/spec/support/factories/repoContextFactory.js` (default
  `repoPath` `/fake/repo`).
- `BranchCleanup` is **not** split into sub-issues — the three phases
  below are three PRs against issue #398.
- Call-site wrinkle: in `AutoFixAllGithub.js` the collaborator default
  `branchCleanup = new BranchCleanup()` sits in a **default parameter**,
  which cannot reference `this._repoContext`. Phase 2 moves that
  construction into the constructor body.
- Existing `BranchCleanup` behavior to preserve throughout: the 4-command
  git sequence and its order, tolerating a failed remote-branch delete
  (`|| true` parity), rejecting on any other step's failure, forwarding
  the unredirected stdout of `git checkout` / `git reset --hard` /
  `git branch -D`, and the `Usage: github.sh cleanup-branch <repo_path>
  <id>` error string (kept verbatim — it names the shell command this
  mirrors, whose signature is unchanged).

## Steps

- [01 — Accept repoContext in the constructor](node/01-accept-repocontext-in-constructor.md)
- [02 — Migrate the AutoFixAllGithub call site](node/02-migrate-autofixallgithub-call-site.md)
- [03 — Remove repoPath from cleanupBranch](node/03-remove-repopath-from-cleanupbranch.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`)

## Notes

- Each phase must land its own PR with `make core-test` and
  `make core-lint` both clean. Phases 1 and 2 are additive / non-breaking;
  phase 3 is the breaking cleanup and must land last.
- Phase ordering is strict: 2 depends on 1, 3 depends on 1 and 2.
- After phase 3, `BranchCleanup` requires a `repoContext` at
  construction — there is no zero-arg usage left anywhere (the only
  callers are `AutoFixAllGithub.js` and the specs, both updated in
  phases 2–3).
- `AutoFixAllGithub`'s own public `cleanupBranch(id)` method signature
  does not change in any phase — only what it forwards to
  `BranchCleanup` does.
