# Issue: Refactor core/lib/AutoFixAllGithub.js

## Problem

`core/lib/commands/AutoFixAllGithub.js` is 784 lines and handles 7 distinct GitHub-facing subcommands (`pr-number`, `pr-state`, `pr-merge`, `cleanup-branch`, `has-shipit-label`, `add-tag`, `remove-tag`). The class mixes PR operations, branch lifecycle, repo resolution, and label/tag mutations — making it hard to test, extend, and reason about.

Worse, several of these concerns are **already implemented** in existing `core/lib/utils/` classes, but `AutoFixAllGithub` duplicates them instead of delegating:

- `IssueTagger` (`utils/issue/IssueTagger.js`, 235 lines) already has `_addLabel`/`_removeLabel` with identical error messages. `AutoFixAllQueue` already delegates tag mutation to `IssueTagger`; `AutoFixAllGithub` does not — it maintains its own copy.
- `Origin` (`utils/git/Origin.js`, 69 lines) already resolves `{ domain, repo }` from the git remote. `AutoFixAllGithub._resolveRepo` is a 3-line wrapper that just adds a `repoRef` field.
- `TAG_TO_LABEL` is re-derived from `LABEL_TO_TAG` in `AutoFixAllGithub` instead of being exported directly from `Tags.js`.

## Solution

### 1. Delegate tag/label operations to `IssueTagger` (consolidation, not extraction)

Remove from `AutoFixAllGithub`:
`_addLabel`, `_removeLabel`, `_mutateTag`, `addTag`, `removeTag`, `hasShipitLabel`.

Inject `IssueTagger` as a constructor dependency (same pattern as `AutoFixAllQueue`):

```
issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs })
```

Map the existing `COMMANDS` registry entries to `IssueTagger` methods, or keep `AutoFixAllGithub` as a thin facade that delegates.

`hasShipitLabel` needs its own decision: it's a read-and-check (`labels.some(l => l.toLowerCase() === 'shipit')`), not a mutation, so it doesn't fit `IssueTagger`'s existing `addLabel`/`removeLabel` shape. `IssueTagger.fetchLabels()` is confirmed byte-identical to `AutoFixAllGithub._fetchLabels()` (same URL, same error message), so the underlying fetch is safe to reuse either way. Decision: add `IssueTagger.hasLabel(id, repo, token, label)`, symmetric with `addLabel`/`removeLabel`. The `DispatchFailure('', 1)` wrapping `hasShipitLabel` currently applies around *any* failure (repo resolution, token fetch, or label fetch) is caller-specific and must stay in `AutoFixAllGithub`'s facade regardless of where the check itself lives — `IssueTagger.hasLabel()` should keep throwing a plain `Error` like its siblings, with the facade converting that to `DispatchFailure('', 1)` in its own try/catch, exactly as today.

### 2. Extract PR operations to a new class

Move to a new `core/lib/utils/github/PrOperations.js`:
`prNumber`, `prState`, `prMerge`, `_findPr`, `_prStateLabel`, `_fetchPrCommits`, `_resolveMergeBody`, `_resolveMergerLogin`, `_deleteBranchRef`, `mergeBodyMode`, `_modelCoauthorOmitted`, `_currentBranch` (only consumer).

This is the only extraction with enough cohesive mass (~400 lines) to justify a dedicated class.

### 3. Extract `cleanup-branch` to a new `core/lib/utils/git/BranchCleanup.js`

`cleanupBranch` (the `cleanup-branch` subcommand) is pure local `git` — `push --delete`, `checkout`, `reset --hard`, `branch -D` — with no `fetch`/GitHub token involved at all, unlike `_deleteBranchRef` (a genuine GitHub REST `DELETE` on a branch ref, correctly moving into `PrOperations.js`). It doesn't fit `IssueTagger` (not tag/label) or `PrOperations.js` (not a GitHub API call — it would carry an unused `fetch`/`githubToken` dependency for this one method). Move it to `core/lib/utils/git/BranchCleanup.js`, alongside `Origin.js`, reflecting that it's git-only rather than GitHub-API-facing.

### 4. Extend `Origin` instead of creating `RepoResolver`

Add `resolveWithRef(repoPath)` to `Origin` that returns `{ domain, repo, repoRef }`, eliminating `_resolveRepo` everywhere.

`IssueTagger` (`utils/issue/IssueTagger.js:76`) independently re-implements this same `domain === 'github.com' ? repo : \`${domain}/${repo}\`` ternary inline — a third instance of the duplicate that the original collision analysis missed (it only compared `AutoFixAllGithub._resolveRepo` against `Origin`). Once `Origin.resolveWithRef()` exists, `IssueTagger` should switch to it too, so all three call sites (PR operations, tag mutation, and `IssueTagger` itself) share one implementation instead of two.

### 5. Export `TAG_TO_LABEL` from `Tags.js`

Move the `Object.fromEntries(Object.entries(LABEL_TO_TAG).map(...))` inversion into `Tags.js` as a second named export, removing re-derivation from `AutoFixAllGithub` (and any other consumer).

### What remains in `AutoFixAllGithub`

After the refactor — with tag/label delegated to `IssueTagger`, PR operations extracted to `PrOperations.js`, and `cleanup-branch` extracted to `BranchCleanup.js` — `AutoFixAllGithub` **stays as a thin facade** (target: under ~100 lines), rather than being removed and having the `COMMANDS` registry in `core/bin/arcanum` restructured to point directly at the new classes. This is a deliberate decision, not left open: `core/lib/commands/AutoFixAllWaitCiAndMerge.js` imports `AutoFixAllGithub` directly and instantiates it (`new AutoFixAllGithub()`) to call `#prMerge` — removing the class would break that consumer and require updating it too. Keeping the thin facade means `AutoFixAllWaitCiAndMerge.js` needs no change.

### Alternative Solutions Considered

**Extract `PrOperations.js` vs. keep PR logic inline in `AutoFixAllGithub`.** The recently-merged `AutoFixAllQueue` refactor (issue #253) — the precedent this issue's proposal cites for the `IssueTagger` delegation pattern — took a more conservative approach overall: it kept its own multi-step transaction (lock → read → write → release) inline in the class, extracting *only* the genuinely duplicated tag-mutation logic to `IssueTagger`. It did not spin off a new class for the transaction logic despite it being non-trivial.

This issue's proposal goes a step further by also extracting the ~400-line PR flow into a new `PrOperations.js`. Confirmed as the right call for this issue: PR/branch lifecycle is a more distinct, more independently-testable concern than a queue transaction, and it's what actually gets `AutoFixAllGithub` down to the ~100-line acceptance target — keeping PR logic inline would mean dropping or loosening that criterion. Decision: proceed with the `PrOperations.js` extraction as proposed.

### Edge Cases

- **`hasShipitLabel` delegation** — resolved above: `IssueTagger.hasLabel()` owns the check, `AutoFixAllGithub`'s facade keeps owning the `DispatchFailure('', 1)` wrapping.
- **Shared `origin`/`githubToken` instances** — once `AutoFixAllGithub`'s constructor builds both an `issueTagger` and a `prOperations` by default, each must be wired from the *same* `origin`/`githubToken` instances the facade's own constructor builds (mirroring `AutoFixAllQueue`'s existing pattern), not from separate defaults each collaborator constructs internally. Purely a wiring concern — `Origin`/`GithubToken` are stateless resolvers, so this doesn't change output — but worth being explicit about so the constructor doesn't end up instantiating two independent `Origin`/`GithubToken` objects for no reason.

### Constraints

- **No behavioral changes** — output must remain byte-identical for all 7 subcommands (parity tests must pass).
- **Dependency injection preserved** — new/extended classes must accept injectable collaborators for testing.
- **Specs** — new classes get dedicated spec files: `PrOperations_spec.js` in `core/spec/lib/utils/github/`, `BranchCleanup_spec.js` in `core/spec/lib/utils/git/`; `IssueTagger_spec.js` may need additional cases for the newly delegated methods (including the new `hasLabel()`).

### Out of scope (tracked separately)

- Improving config reading code (`ConfigChain` / `RepoConfig`) — note to be added to `docs/agents/todo/better_config.md` as a separate follow-up issue.

### Acceptance criteria

- [ ] `AutoFixAllGithub.js` stays as a thin facade, under ~100 lines; `AutoFixAllWaitCiAndMerge.js`'s direct `new AutoFixAllGithub()` / `#prMerge` usage keeps working unchanged.
- [ ] `IssueTagger` handles all tag/label operations — no duplicate `_addLabel`/`_removeLabel` in `AutoFixAllGithub`.
- [ ] `IssueTagger.hasLabel()` exists and is used by `AutoFixAllGithub#hasShipitLabel`; the `DispatchFailure('', 1)` wrapping around repo/token/label-fetch failures stays in the facade, unchanged.
- [ ] `PrOperations.js` exists in `core/lib/utils/github/` with dedicated spec file.
- [ ] `BranchCleanup.js` exists in `core/lib/utils/git/` with dedicated spec file, handling the `cleanup-branch` subcommand; no GitHub API dependency (`fetch`/`githubToken`) is introduced for it.
- [ ] `Origin.resolveWithRef()` exists; `_resolveRepo` removed.
- [ ] `IssueTagger` uses `Origin.resolveWithRef()` instead of its own inline `repoRef` computation (`IssueTagger.js:76`).
- [ ] `TAG_TO_LABEL` exported from `Tags.js`; no re-derivation in consumers.
- [ ] All existing parity tests pass without assertion changes.
- [ ] `yarn lint` and `yarn test` pass in `core/`.

### Collision analysis with existing `core/lib/utils/` classes

| Existing class | Location | Lines | Collision with | Action |
| --- | --- | --- | --- | --- |
| `IssueTagger` | `core/lib/utils/issue/IssueTagger.js` | 235 | `_addLabel`, `_removeLabel`, `_mutateTag`, `addTag`, `removeTag`, `hasShipitLabel` | Delegate to `IssueTagger` (same pattern as `AutoFixAllQueue`) |
| `Origin` | `core/lib/utils/git/Origin.js` | 69 | `_resolveRepo` (3-line wrapper over `Origin.resolve`); `IssueTagger.js:76`'s own inline `repoRef` ternary | Extend `Origin` with `resolveWithRef()`; update `IssueTagger` to use it too |
| `Tags.js` | `core/lib/utils/issue/Tags.js` | 61 | `TAG_TO_LABEL` re-derived from `LABEL_TO_TAG` | Export `TAG_TO_LABEL` directly from `Tags.js` |
| `GithubToken` | `core/lib/utils/github/GithubToken.js` | 96 | Token resolution (already injected) | No change — already a dependency |
| _(none)_ | `core/lib/utils/git/BranchCleanup.js` (new) | — | `cleanupBranch` (pure local `git`, no GitHub API) — not a collision, a new extraction | Extract to a new class, separate from `PrOperations.js` since it needs no `fetch`/`githubToken` |
| `ConfigChain` | `core/lib/utils/config/ConfigChain.js` | — | `mergeBodyMode`, `_modelCoauthorOmitted` config reads | No change — stays as injected dependency |

### Summary of changes vs. original issue

| Aspect | Original issue #284 | Improved proposal |
| --- | --- | --- |
| Context | "is just too big" | 784 lines, 7 subcommands, duplicated logic |
| New classes | 3 vague (PrOperations, BranchOperations, RepoResolver) | 2 new (PrOperations, BranchCleanup); 2 existing classes extended (Origin, Tags); 1 existing class reused (IssueTagger, plus a new `hasLabel()`) |
| Duplication | Not addressed | Identifies IssueTagger/Origin/Tags collisions and consolidates |
| Acceptance criteria | Absent | 7-item checklist with measurable targets |
| Config item | Mixed in body | Separated as out-of-scope follow-up |
| "suggest more" | Placeholder | Removed — replaced with concrete collision analysis |
| Labels | `Writting` (typo) | `Writing` (corrected) |
