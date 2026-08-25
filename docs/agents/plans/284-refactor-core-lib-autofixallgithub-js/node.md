# Plan: Refactor core/lib/AutoFixAllGithub.js

Issue: [284-refactor-core-lib-autofixallgithub-js.md](../../issues/284-refactor-core-lib-autofixallgithub-js.md)

## Overview

Shrink `core/lib/commands/AutoFixAllGithub.js` from 784 lines down to a thin, ~100-line facade by delegating its duplicated tag/label logic to `IssueTagger`, extracting its GitHub PR/branch-lifecycle logic to a new `PrOperations.js`, and extracting its local-git `cleanup-branch` logic to a new `BranchCleanup.js` — with byte-identical output preserved across all 7 subcommands (`pr-number`, `pr-state`, `pr-merge`, `cleanup-branch`, `has-shipit-label`, `add-tag`, `remove-tag`).

## Context

`AutoFixAllGithub` mixes four concerns that already have (or deserve) a home elsewhere:

- Tag/label mutation duplicates `IssueTagger` (`core/lib/utils/issue/IssueTagger.js`) almost line-for-line, including error messages.
- Repo/domain resolution (`_resolveRepo`) duplicates `Origin.resolve()` (`core/lib/utils/git/Origin.js`) plus a `repoRef` derivation that `IssueTagger.js:76` *also* independently re-implements — a third copy of the same ternary.
- PR lookup/state/merge logic (~400 lines) is a cohesive, independently-testable concern with no existing home.
- `cleanup-branch` is pure local `git` (no `fetch`/GitHub token at all) and doesn't fit either the tag/label or the GitHub-REST concern.

`core/lib/commands/AutoFixAllWaitCiAndMerge.js` imports `AutoFixAllGithub` directly and instantiates it (`new AutoFixAllGithub()`) to call `#prMerge` — `AutoFixAllGithub` must stay a facade, not be removed, so this consumer needs no change.

`TAG_TO_LABEL` is also re-derived from `Tags.js`'s `LABEL_TO_TAG` in `AutoFixAllGithub` instead of being exported directly.

## Steps

- [01 — Export TAG_TO_LABEL from Tags.js](node/01-export-tag-to-label.md)
- [02 — Extend Origin and update IssueTagger](node/02-extend-origin-and-issuetagger.md)
- [03 — Extract PrOperations.js](node/03-extract-pr-operations.md)
- [04 — Extract BranchCleanup.js](node/04-extract-branch-cleanup.md)
- [05 — Reduce AutoFixAllGithub to a thin facade](node/05-reduce-autofixallgithub-to-facade.md)
- [06 — Update specs and verify parity](node/06-update-specs-and-verify.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- **No behavioral changes** — output must remain byte-identical for all 7 subcommands; existing parity tests must pass without assertion changes.
- `AutoFixAllGithub` stays as a thin facade (not removed) — this is a deliberate, settled decision (see issue), since `AutoFixAllWaitCiAndMerge.js` depends on it directly.
- New/extended classes must accept injectable collaborators (constructor DI), matching the existing `IssueTagger`/`AutoFixAllQueue` pattern.
- Config reading (`ConfigChain`/`RepoConfig`) improvements are explicitly out of scope — tracked separately per the issue.
