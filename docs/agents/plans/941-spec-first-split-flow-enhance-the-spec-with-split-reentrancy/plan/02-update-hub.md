# Update the hub

Edit `docs/agents/specs/spec-first-split-flow/specs.md` so the hub reflects the new part. This covers the issue's acceptance criterion on the hub.

- **Key decisions:** add a bullet, e.g. `- Split reentrancy: the spec-driven split, coverage check, recursion guard and fold blockers: [reentrancy.md](reentrancy.md)`. Place it after the `ordering.md` bullet.
- **Open points:** remove the `#941, split reentrancy (...)` bullet. Leave the #942, #943 and #944 bullets as they are.
- **Parts:** add `- [reentrancy.md](reentrancy.md)` after `ordering.md`, keeping the same relative order as Key decisions.
- **Fold map:** add the row `| \`reentrancy.md\` | \`docs/agents/architecture/spec-pipeline.md\` |`, placed after the `ordering.md` row.
- Leave `Status` alone here. Step 04 decides it.

## Files to Change

- `docs/agents/specs/spec-first-split-flow/specs.md` — link the part in Key decisions and Parts, drop the #941 open point, and add the fold-map row.
