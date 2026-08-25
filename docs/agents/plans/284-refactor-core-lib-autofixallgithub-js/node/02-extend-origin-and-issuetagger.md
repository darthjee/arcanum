# Extend Origin and update IssueTagger

Add `resolveWithRef(repoPath)` to `Origin`, returning `{ domain, repo, repoRef }` (where `repoRef` is `repo` when `domain === 'github.com'`, else `` `${domain}/${repo}` ``) — the same derivation currently duplicated in `AutoFixAllGithub._resolveRepo` and independently re-implemented inline in `IssueTagger.js:76`. Update `IssueTagger` to use `Origin.resolveWithRef()` in `markEnqueued` instead of its own inline ternary.

Also add `IssueTagger.hasLabel(id, repo, token, label)`, symmetric with the existing `addLabel`/`removeLabel`, reusing the existing `fetchLabels()` and throwing a plain `Error` on failure (not `DispatchFailure` — that wrapping is caller-specific and stays in `AutoFixAllGithub`'s facade in step 05).

## Files to Change

- `core/lib/utils/git/Origin.js` — add `resolveWithRef(repoPath)`, built on top of the existing `resolve(repoPath)`.
- `core/spec/lib/utils/git/Origin_spec.js` — add coverage for `resolveWithRef()`, both the `github.com` and non-`github.com` domain cases.
- `core/lib/utils/issue/IssueTagger.js` — inject/use `Origin.resolveWithRef()` in `markEnqueued` instead of the inline `resolved.domain === 'github.com' ? ... ` ternary; add `hasLabel(id, repo, token, label)`.
- `core/spec/lib/utils/issue/IssueTagger_spec.js` — add coverage for `hasLabel()` (present/absent/fetch-failure cases) and update any assertions that relied on the old inline `repoRef` derivation being local to this file.
