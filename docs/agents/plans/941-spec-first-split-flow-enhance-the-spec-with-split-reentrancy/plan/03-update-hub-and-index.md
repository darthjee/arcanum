# Update the hub and the specs index

Edit `docs/agents/specs/spec-first-split-flow/specs.md`:

- `## Key decisions`: add a bullet, e.g. "Split reentrancy: the spec-driven split, coverage, the recursion guard and fold links: [reentrancy.md](reentrancy.md)", placed after the ordering bullet.
- `## Parts`: add `- [reentrancy.md](reentrancy.md)` (after `ordering.md`, keeping the same order as Key decisions).
- `## Open points`: remove the #941 entry. Add an entry saying the canonical issue-type label names (including the implementation-split and fold type labels) are not yet defined by any part, and are to be named by #938 implementation item 8.
- `## Fold map`: add the row `| \`reentrancy.md\` | \`docs/agents/architecture/spec-pipeline.md\` |` (after `ordering.md`).
- `Status`: apply the "Spec status" rule. Check #942, #943, #944 with `gh issue view <n> --json state`. If any is open (all three were open at planning time), leave `Drafting`. Only if all are closed, set `Ready` in the hub and in the spec's row in `docs/agents/specs.md`.

Optionally widen the spec's one-line summary in `docs/agents/specs.md` to mention split reentrancy; keep it one line.

## Files to Change
- `docs/agents/specs/spec-first-split-flow/specs.md` — Key decisions, Parts, Open points, Fold map, Status (per rule).
- `docs/agents/specs.md` — Status column only if it changes to `Ready`; optional summary tweak.
