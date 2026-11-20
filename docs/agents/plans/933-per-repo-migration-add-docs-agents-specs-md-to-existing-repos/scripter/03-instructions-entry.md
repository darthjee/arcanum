# Write the instructions entry

Fill `002.md` (short description) and `002.instructions.md`, modeled on
`arcanum/migrations/repos/0.13.0/002.instructions.md`. The instructions tell the AI to:

1. Do nothing (mark complete) when `AGENTS.md` does not exist.
2. Read the canonical text from `init-claude/templates/agents-documentation-section.md` in the
   arcanum install: the `| [Specs](docs/agents/specs.md) | ... |` table row and the
   `### Specs (\`docs/agents/specs/\`)` subsection.
3. If `AGENTS.md` has no `## Documentation` section, ask the user where (or whether) to add the
   specs index rather than guessing.
4. Add only the piece(s) missing: the row (placed in the Documentation table, e.g. after the
   Issues row) and/or the subsection. An existing link to `docs/agents/specs.md` counts as the row
   being present.
5. If the section is shaped differently from the template (bullet list, prose), follow its
   existing format rather than forcing a table row in.
6. Never touch anything else in `AGENTS.md`; save the file.

## Files to Change
- `arcanum/migrations/repos/next/002.md` — description.
- `arcanum/migrations/repos/next/002.instructions.md` — AI instructions.
