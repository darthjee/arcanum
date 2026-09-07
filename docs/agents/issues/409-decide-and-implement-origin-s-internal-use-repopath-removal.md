# Issue: Decide and implement Origin's internal-use repoPath removal

## Description

Follow-up to #399 (Refactor Origin to take repoContext in its constructor). `Origin#resolve`/
`Origin#resolveWithRef` (`core/lib/utils/git/Origin.js`) currently take `repoPath` as a plain
required positional argument — `Origin` has no `repoContext` concept at all yet, and #399
(still open) hasn't landed. `RepoContext.js`/`RepoContextFactory.js` build `origin = new
Origin()` as a bare parameter default and pass `this.repoPath` explicitly on every call.

This issue absorbs #399's Phase 1 (adding `repoContext` to `Origin`'s constructor) and
resolves the follow-up question #399 identified: once `Origin` accepts a constructor-injected
`repoContext`, should `resolve`/`resolveWithRef`'s `repoPath` parameter be kept as a
documented per-call override, or dropped entirely? `RepoContext`/`RepoContextFactory` build
`Origin` before any `RepoContext` instance exists (`origin = new Origin()`), so a
zero-arg-safe answer is required either way.

## Problem

Unlike `QueueStore` (single caller, #395), `Origin` can't simply drop `repoPath` from its
method signatures without first accepting `repoContext` at all — that constructor change
(#399's Phase 1) hasn't been implemented, so `Origin` still forces every caller to pass
`repoPath` explicitly on every call, with no way to bind it once via a constructor. Left
unresolved, `RepoContext`/`RepoContextFactory` keep building `Origin` as a bare
`new Origin()` parameter default (not the body-assigned `?? new X({ repoContext: this })`
self-bootstrap pattern already used there for `githubToken`/`issueStateService`/
`githubIssueService`), and the migration described in #399 never completes.

## Solution

Chosen: **permanent optional override**, mirroring the `GithubToken`/`ConfigChain` precedent
already in the codebase (`repoPath ?? this._repoContext?.repoPath`, explicit arg always
wins).

1. **Phase 1 — `Origin` accepts `repoContext`** (absorbs #399's Phase 1): give `Origin`'s
   constructor an optional `repoContext` dependency, same shape as `GithubToken`/
   `ConfigChain`. `resolve`/`resolveWithRef` keep `repoPath` as their first parameter, falling
   back to `this._repoContext?.repoPath` when omitted; an explicitly passed `repoPath` always
   wins over the constructor-injected context.
2. **`RepoContext` self-bootstraps `Origin`**: move `origin`'s construction from a bare
   parameter default (`origin = new Origin()`) into the constructor body, self-bootstrapped
   and `??`-merged like the existing `githubToken`/`issueStateService`/`githubIssueService`
   lines: `this._origin = origin ?? new Origin({ repoContext: this });`. `RepoContext#resolve`/
   `#resolveWithRef` can keep passing `this.repoPath` explicitly, or rely on the fallback —
   either is valid under this option, so leave the existing explicit calls as-is unless it's
   free to simplify them.
3. **`RepoContextFactory`** gets the equivalent treatment for its own shared `this._origin`.
4. `repoPath` is **not removed** from `Origin#resolve`/`resolveWithRef` — it remains a
   documented, permanent per-call override on top of the constructor-injected `repoContext`.

## Done when

- `Origin`'s constructor accepts an optional `repoContext` dependency; `resolve`/
  `resolveWithRef` fall back to `this._repoContext?.repoPath` when `repoPath` is omitted, with
  an explicit `repoPath` argument always taking precedence.
- `RepoContext`/`RepoContextFactory` build `Origin` via the body-assigned,
  `??`-merged self-bootstrap pattern (`this._origin = origin ?? new Origin({ repoContext: this });`),
  consistent with how they already build `githubToken`/`issueStateService`/
  `githubIssueService`.
- `make core-test` passes; `make core-lint` is clean.

## Out of scope

- `GithubIssueService.js` — a third direct caller of `Origin#resolve`/`resolveWithRef` with its
  own per-call `repoPath` override, but it duck-types a non-`RepoContext` object (per the
  `services/` → `context/` layering ban from #393) rather than holding a real `RepoContext`.
  Its handling is a separate concern from this issue's `Origin`/`RepoContext`/
  `RepoContextFactory` scope.
- Any other repoPath-per-call utility — see the companion issues for `QueueStore.js`,
  `RepoConfig.js`, `IssueStatePaths.js`, `BranchCleanup.js`, `GithubToken.js`,
  `ConfigChain.js`, and `IssueFile.js`.
