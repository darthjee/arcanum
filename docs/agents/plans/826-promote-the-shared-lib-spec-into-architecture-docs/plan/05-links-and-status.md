# Repoint spec links and mark the spec Implemented

Repoint every link to `docs/agents/specs/shared-lib.md` in docs and agent files to `docs/agents/architecture/shared-lib.md`, mapping the spec's anchors to the new doc's sections (`#ownership` → `#ownership`, `#import-boundary` → `#import-boundary`):

- `docs/agents/architecture/agent-roster-and-delegation.md`, lines 15 and 20: "per the Shared Lib spec" becomes "see [Shared Lib](shared-lib.md)".
- `docs/agents/folder-structure.md`, line 24: the `shared/` row.
- `.claude/agents/shared.md`:
  - line 35: the import-boundary link;
  - line 49: replace "Until #826 promotes it into the architecture docs, the design lives in the Shared Lib spec" with "The design lives in [Shared Lib](../../docs/agents/architecture/shared-lib.md)", keeping "Align with `architect` before changing anything it defines".
- `.claude/agents/node.md`, line 13: the ownership link.
- Any `arcanum-cli` spec cross-links that step 03 didn't already change.

Mark the spec as promoted:

- `docs/agents/specs.md`: set the Shared Lib row's Status to `Implemented`. The row stays until #827 removes the spec.
- `docs/agents/specs/shared-lib.md`, Status section: replace "Proposed. Nothing in this spec is implemented yet." with "Implemented (#818–#826) and promoted to [Shared Lib](../architecture/shared-lib.md), which is now the source of truth. This spec is kept until #827 removes it." Drop the sentence about the "Suspended" banners, which step 03 removes. Don't change the rest of the spec.

Do not touch code comments or messages (the `core/`, `cli/` and `shared/` ESLint configs, `shared/README.md`). #827 repoints those.

## Files to Change

- `docs/agents/architecture/agent-roster-and-delegation.md`
- `docs/agents/folder-structure.md`
- `.claude/agents/shared.md`
- `.claude/agents/node.md`
- `docs/agents/specs.md`
- `docs/agents/specs/shared-lib.md`
