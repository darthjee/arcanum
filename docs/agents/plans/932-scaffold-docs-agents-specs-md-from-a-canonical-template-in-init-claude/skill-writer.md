# Skill-writer Plan: Scaffold docs/agents/specs.md from a canonical template in /init-claude

Main plan: [plan.md](plan.md)

## Shared contracts

The script now also creates `docs/agents/specs.md` (from `init-claude/templates/specs.md`) and `docs/agents/specs/.gitkeep` (only when the directory is missing or empty). The appended `## Documentation` section comes from `init-claude/templates/agents-documentation-section.md` and includes the specs index. On stderr the script may print a `Note:` (existing `specs.md` left untouched) and `Warning:` lines (`docs/agents/specs` not a directory; existing Documentation section with no `docs/agents/specs.md` link). Full contract: [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Update setup_docs_structure.md

In `init-claude/setup_docs_structure.md`, add the two new paths to the "The script creates" list, say the Documentation section comes from the template and links the specs index, and in Step 2 ("Confirm") tell the agent to relay any `Note:`/`Warning:` lines from stderr to the user as-is (in particular the instruction to add the Specs row and subsection by hand). Do not tell it to edit `AGENTS.md` or `specs.md` itself.

## Files to Change
- `init-claude/setup_docs_structure.md` — created-files list, template mention, relaying the note and warnings.

## Notes

- Do not mention `/arcanum-migrate` as a way to repair an existing `specs.md`; the migration (#933) does not repair it either.
