# Issue: Remove the shared lib spec

## Description
Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent). This is the last item of the epic. See the epic for the full design decisions.

#826 promoted the spec's design into [Shared Lib](docs/agents/architecture/shared-lib.md), which is now the source of truth. The spec `docs/agents/specs/shared-lib.md` now says only that it is kept until this issue removes it. Delete it, and repoint the links that still go to it.

## Problem
The links to the spec that #826 left out of scope are code comments and lint messages:

- `core/eslint.config.mjs`: the `SHARED_SPEC_BAN` comment (line 7) and its `message` (line 11).
- `shared/eslint.config.mjs`: the import-boundary comment (line 54).
- `cli/eslint.config.mjs`: the two `no-restricted-imports` messages, for `core/` (line 104) and for `shared/spec/` (line 110).
- `shared/README.md`: "The design lives in the [Shared Lib spec]" (line 8).
- `docs/agents/specs.md`: the `Shared Lib` row, marked Implemented.

Every other doc and agent file already links to the architecture doc. The spec has no `docs/agents/specs/shared-lib/` folder.

## Expected Behavior
- `docs/agents/specs/shared-lib.md` is deleted.
- Its row is removed from `docs/agents/specs.md`, per that index's rule that a removed spec loses its entry.
- Each code comment and lint message above points to `docs/agents/architecture/shared-lib.md`. Where the text is about the import boundary, it points to the `#import-boundary` anchor.
- `shared/README.md` links to [Shared Lib](../docs/agents/architecture/shared-lib.md).
- `grep -rn 'specs/shared-lib'` over the repo, excluding `docs/agents/issues/` and `docs/agents/plans/` (historical records, left as is), finds nothing.
- Lint passes in `core/`, `cli/` and `shared/`. No spec asserts on the lint message text, so no test changes.

## Solution
- **Owners, by folder:** `node` owns `core/eslint.config.mjs`, `client` owns `cli/eslint.config.mjs`, and `shared` owns `shared/eslint.config.mjs` and `shared/README.md`. `architect` deletes the spec and edits `docs/agents/specs.md`. If a specialist's dispatch is blocked or fails, `architect` makes that text edit itself as the fallback.
- The edits are text only: no rule, regex or behavior changes.

## Benefits
- Closes epic #816: one source of truth for the shared lib design, with no stale spec left behind.
- Lint errors and code comments send readers to the current doc.
