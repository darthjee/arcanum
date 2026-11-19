# Add the canonical templates

Create `init-claude/templates/specs.md` and `init-claude/templates/agents-documentation-section.md` exactly as described in the shared contracts. For `specs.md`, start from arcanum's own `docs/agents/specs.md` and drop the `Shell Engine Removal` data row. For the documentation section, take the heredoc body in `setup_docs_structure_shell.sh` (dropping the leading blank line), then add the `Specs` row and the `### Specs` subsection from arcanum's `AGENTS.md`, using the neutral example `docs/agents/specs/user-authentication.md`.

Arcanum's own `docs/agents/specs.md` and `AGENTS.md` are not changed.

## Files to Change
- `init-claude/templates/specs.md` — new, canonical specs index with an empty table.
- `init-claude/templates/agents-documentation-section.md` — new, the `## Documentation` section with the specs index.
