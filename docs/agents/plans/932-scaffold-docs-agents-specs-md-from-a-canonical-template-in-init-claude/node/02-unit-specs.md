# Unit specs

Extend `InitClaudeSetupDocsStructure_spec.js`:

- Fresh repo: creates `docs/agents/specs.md` byte-identical to `init-claude/templates/specs.md` and `docs/agents/specs/.gitkeep`; the appended section equals `'\n' + agents-documentation-section.md` and contains the Specs row and subsection.
- Existing `specs.md` (populated content): unchanged, listed as skipped, `Note:` on stderr.
- `docs/agents/specs/` with a spec file in it: no `.gitkeep`, not listed, `specs.md` still created.
- Empty `docs/agents/specs/` directory: `.gitkeep` created.
- `docs/agents/specs` is a file: not overwritten, `Warning:` on stderr.
- `AGENTS.md` with `## Documentation` but no `docs/agents/specs.md` link: unchanged, `Warning:` on stderr; with the link: no warning.
- `templatePath` injection is honored, and the default resolves into the install's `init-claude/templates/`.
- Update existing expectations (file lists, re-run skip lists, section content) for the two new entries.

## Files to Change
- `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js` — new and updated cases.
