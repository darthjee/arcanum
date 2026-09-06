# Migrate call sites

Update both production callers to construct `RepoConfig` with `this._repoContext` instead
of zero-arg, and stop passing `repoContext.repoPath` to each call:

- `SafeBranch` (`core/lib/commands/shared/SafeBranch.js`) — change the `repoConfig =
  new RepoConfig()` default parameter to `repoConfig = new RepoConfig(this._repoContext)`.
  Since `repoConfig` is an injectable default-parameter and the constructor default can't
  reference `this._repoContext` (not yet assigned when defaults evaluate), assign the
  `repoContext`-bound `RepoConfig` explicitly in the constructor body instead, or move the
  default's construction after `this._repoContext` is set, whichever keeps the existing
  `deps.repoConfig` override for specs working unchanged. Drop the `repoPath` argument
  from `this._repoConfig.getSafeBranch(repoPath)` in `checkout()`, relying on the
  `repoContext` now injected at construction (per step 01's fallback).
- `AutoFixAllWaitCi` (`core/lib/commands/auto-fix-all/AutoFixAllWaitCi.js`) — same change:
  construct `repoConfig` bound to `this._repoContext` instead of zero-arg, and drop the
  `repoPath` argument from `this._repoConfig.getIgnoredCheckPatterns(repoPath)`.

## Files to Change

- `core/lib/commands/shared/SafeBranch.js` — construct `RepoConfig` with
  `this._repoContext`; remove the `repoPath` argument from the `getSafeBranch` call.
- `core/spec/lib/commands/shared/SafeBranch_spec.js` — update any expectations that
  assert `getSafeBranch` was called with `repoPath` as an argument, and any assertion on
  how the default `RepoConfig` is constructed, to match the new `repoContext`-only call
  shape.
- `core/lib/commands/auto-fix-all/AutoFixAllWaitCi.js` — construct `RepoConfig` with
  `this._repoContext`; remove the `repoPath` argument from the
  `getIgnoredCheckPatterns` call.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiIgnoredPatterns_spec.js` and
  `core/spec/support/factories/autoFixAllWaitCi.js` — update any expectations that assert
  `getIgnoredCheckPatterns` was called with `repoPath` as an argument, and any assertion
  on how the default `RepoConfig` is constructed, to match the new `repoContext`-only call
  shape.
