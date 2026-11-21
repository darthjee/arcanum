# Node Plan: Split specs awareness: Specs concern in the split checklist and a per-repo migration to add it

Main plan: [plan.md](plan.md)

## Shared contracts

- Append the Specs bullet from [plan.md](plan.md#shared-contracts) verbatim as the last element of `SPLIT_ISSUE_CONTENT`.
- Rely on scripter's `arcanum/migrations/repos/next/003.instructions.md` quoting the bullet as the only line starting with `- **Specs** —`, and on the `003` manifest entry shape in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Native seed and seed specs

- In `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`, add the Specs bullet as the last line of `SPLIT_ISSUE_CONTENT`.
- In `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js`, extend the `docs/agents/arcanum-split-issue.md` expectations (around line 122) to assert the seeded file contains the Specs bullet.
- `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js` already compares `docs/agents/arcanum-split-issue.md` across engines. Confirm it passes once scripter's shell change lands; add nothing unless a byte-level assertion is missing.

### Step 2 — Manifest contract and drift-guard spec

Add `core/spec/bin/migrationsSplitChecklistSpecs_spec.js`, following `core/spec/bin/migrationsSpecsIndex_spec.js` and the Per-Repo Migrations spec convention:

- `const INSTRUCTIONS = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/003.instructions.md');`
- `const DESCRIPTION = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/003.md');`
- Derive the manifest path as `path.join(path.dirname(INSTRUCTIONS), 'migrations.json')`. Never write the manifest as a literal, and never assemble `'repos', 'next'`.
- `describe('split checklist specs-concern migration', ...)` with no folder in the title:
  - **declares a skippable repo-scoped instructions entry for 003:** `toEqual` the contract object.
  - **ships both files:** `003.md` and `003.instructions.md` exist.
  - **drift guard:** extract the single line starting with `- **Specs** —` from `003.instructions.md` (expect exactly one), run the native `setup_docs_structure` command into a temp repo (reuse the helper the init-claude specs use), and assert the seeded `docs/agents/arcanum-split-issue.md` contains that line.

## Files to Change

- `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js`: new bullet in `SPLIT_ISSUE_CONTENT`.
- `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js`: assert the bullet.
- `core/spec/bin/migrationsSplitChecklistSpecs_spec.js`: new manifest-contract and drift-guard spec.

## CI Checks

- `core`: `make core-test` and `make core-lint` (CI jobs run `yarn test` / `yarn lint` in `core/`). `core/spec/bin/migrationSpecReferences_spec.js` enforces the path-literal rules.

## Notes

- Depends on scripter's files existing. Run the specs after both land.
