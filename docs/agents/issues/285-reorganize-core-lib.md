# Issue: Reorganize core/lib/ into subfolders

## Problem

`core/lib/` is currently a flat folder with 36 files, and `core/spec/lib/` mirrors it with 35 spec files. The flat layout makes it hard to see which files are dispatched command entrypoints versus shared utilities, and which utilities belong to which domain.

Two pre-existing issues surfaced while investigating this reorg:
- `DispatchFailure` has no dedicated spec file today (exercised only indirectly via other specs) — a gap in the "specs mirror lib" rule.
- `Greeter.js` is dead code: not registered in `core/bin/arcanum`'s `COMMANDS` table, not imported anywhere, and its own docstring says it was "temporary — scheduled for removal once #193 lands" (#193 already landed).

## Proposed structure

Split rule: **`commands/` holds every module dispatched directly through `core/bin/arcanum`'s `COMMANDS` registry, regardless of its content/domain; `utils/` holds everything else, grouped into one subfolder per domain concern.** A domain subfolder with no remaining members is dropped rather than kept empty.

```
core/lib/
├── commands/                  # entrypoints dispatched via core/bin/arcanum's COMMANDS registry
│   ├── ArcanumSplitIssueCreateSubIssue.js
│   ├── ArcanumSplitIssueCreateSubIssueFile.js
│   ├── ArcanumSplitIssueFinish.js
│   ├── ArcanumSplitIssuePushSubIssues.js
│   ├── ArcanumUpdateRunUpdate.js
│   ├── AutoFixAllCheckoutFromMain.js
│   ├── AutoFixAllCleanupArtifacts.js
│   ├── AutoFixAllConfig.js
│   ├── AutoFixAllGithub.js
│   ├── AutoFixAllQueue.js
│   ├── AutoFixAllReplyComment.js
│   ├── AutoFixAllWaitCi.js
│   ├── AutoFixAllWaitCiAndMerge.js
│   ├── DispatchFixture.js
│   ├── GithubIssue.js
│   ├── IssueState.js
│   ├── ListAgents.js
│   ├── PermissionGrant.js
│   ├── ResolveAndFetch.js
│   ├── ResolveIdAndFile.js
│   ├── ResolvePlanPaths.js
│   ├── SafeBranch.js
│   └── SpawnIssue.js
└── utils/
    ├── github/                # GitHub API tools
    │   └── GithubToken.js
    ├── queue/                 # queue-related logic
    │   └── QueueStore.js
    ├── file/                  # file manipulation
    │   ├── Lock.js
    │   ├── IssueFile.js
    │   └── RepoPath.js
    ├── config/                # config reading/setting
    │   ├── ConfigChain.js
    │   └── RepoConfig.js
    ├── issue/                 # issue tagging
    │   ├── IssueTagger.js
    │   └── Tags.js
    ├── git/                   # git operations
    │   └── Origin.js
    ├── logging/               # invocation logging
    │   └── InvocationLog.js
    └── errors/                # shared error/failure-signaling classes
        └── DispatchFailure.js
```

`Greeter.js` (and `Greeter_spec.js`) are **deleted**, not moved — confirmed dead code.

## Category breakdown

| Category | Files | Count |
| --- | --- | --- |
| commands/ | ArcanumSplitIssueCreateSubIssue, ArcanumSplitIssueCreateSubIssueFile, ArcanumSplitIssueFinish, ArcanumSplitIssuePushSubIssues, ArcanumUpdateRunUpdate, AutoFixAllCheckoutFromMain, AutoFixAllCleanupArtifacts, AutoFixAllConfig, AutoFixAllGithub, AutoFixAllQueue, AutoFixAllReplyComment, AutoFixAllWaitCi, AutoFixAllWaitCiAndMerge, DispatchFixture, GithubIssue, IssueState, ListAgents, PermissionGrant, ResolveAndFetch, ResolveIdAndFile, ResolvePlanPaths, SafeBranch, SpawnIssue | 23 |
| utils/github/ | GithubToken | 1 |
| utils/queue/ | QueueStore | 1 |
| utils/file/ | Lock, IssueFile, RepoPath | 3 |
| utils/config/ | ConfigChain, RepoConfig | 2 |
| utils/issue/ | IssueTagger, Tags | 2 |
| utils/git/ | Origin | 1 |
| utils/logging/ | InvocationLog | 1 |
| utils/errors/ | DispatchFailure | 1 |
| **Deleted** | Greeter | − |

35 files remain after deleting `Greeter.js` (36 − 1); 23 + 12 = 35.

## Design notes

- **Split rule settled through discussion**: earlier drafts split `commands/` vs `utils/` by content/domain, which put several `COMMANDS`-dispatched entrypoints (`ResolveAndFetch`, `GithubIssue`, `IssueState`, `SafeBranch`, `PermissionGrant`, `ResolveIdAndFile`, `ResolvePlanPaths`) under `utils/*`. Verified against `core/bin/arcanum`'s `COMMANDS` table: all 7 are in fact registry entries, so all 7 move to `commands/`. The rule is now purely "is this looked up through `COMMANDS`", not domain content.
- **`utils/permissions/` removed**: it held only `PermissionGrant.js`, which moved to `commands/` under the rule above, leaving the subfolder empty.
- **`utils/errors/` is new**: `DispatchFailure.js` is imported directly by `core/bin/arcanum` (as the error class checked via `instanceof`), not looked up through the `COMMANDS` table, so it doesn't qualify for `commands/` under the settled rule — same shape as `InvocationLog.js`, which stays in `utils/logging/`. Placed in its own `utils/errors/` subfolder rather than folded into `utils/logging/`, since it is not a logging concern.
- **`Greeter.js` deleted**: confirmed unreferenced anywhere (not in `COMMANDS`, not imported by any other file) and its own docstring already called for removal once #193 landed.

## Rules

- `commands/` holds every module dispatched directly through `core/bin/arcanum`'s `COMMANDS` registry, regardless of domain.
- Each subfolder under `utils/` groups the remaining (non-dispatched) files by domain concern; a domain with no remaining members is dropped.
- `core/spec/lib/` **must** mirror the exact same subfolder structure.
- Update all `require()`/`import` paths across the codebase after moving — this includes the sibling imports among `core/lib/*.js` files, the imports in `core/spec/lib/*_spec.js`, and the imports in `core/bin/arcanum`.
- **`core/bin/arcanum`'s `COMMANDS` registry must be updated** — every entry's `module:` value is currently a bare filename (e.g. `'SpawnIssue.js'`) joined against `libDir`; all entries need their `module` value prefixed with `commands/` (all dispatched files land there). Its direct imports of `DispatchFailure.js` and `InvocationLog.js` need their paths updated to `../lib/utils/errors/DispatchFailure.js` and `../lib/utils/logging/InvocationLog.js`. This is a functional change, not cosmetic.
- No file content changes beyond import/require paths and the `COMMANDS.module` values above, except: deleting `Greeter.js`/`Greeter_spec.js`, and adding `DispatchFailure_spec.js` (see checklist).
- Confirmed: no skill script (`skills/*/scripts/*.sh`) or the Makefile shells out to `node core/lib/X.js` directly, so nothing outside `core/` needs a functional change. Some `core/lib/*.js` JSDoc comments cite sibling files by their current flat path and should be updated too, for consistency.

## Checklist

- [ ] Create the finalized subfolder structure in `core/lib/`
- [ ] Move files to their respective subfolders per the structure above
- [ ] Delete `Greeter.js` and `Greeter_spec.js` (confirmed dead code)
- [ ] Mirror the same structure in `core/spec/lib/`
- [ ] Add `core/spec/lib/utils/errors/DispatchFailure_spec.js` to close the pre-existing spec-mirror gap
- [ ] Update all import/require paths (`core/lib/*.js` sibling imports, `core/spec/lib/*_spec.js` imports, `core/bin/arcanum` imports)
- [ ] Update `core/bin/arcanum`'s `COMMANDS` registry `module` values to the `commands/` prefix, and its direct `DispatchFailure`/`InvocationLog` import paths
- [ ] Update stale JSDoc path references inside moved files
- [ ] Ensure tests pass (`yarn test` in `core/`)
- [ ] Verify no broken references in scripts or docs
