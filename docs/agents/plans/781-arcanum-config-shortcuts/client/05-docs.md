# Help and docs
Document the shortcuts.

- Help text for each shortcut namespace and form. `ignore-checks` help says its patterns are case-insensitive regexes, not globs.
- `cli/README.md`: a shortcuts section listing the shortcut, key and default tier from the spec, with examples.
- Extend the CLI architecture doc and the end-user guide that #780 added with a shortcuts section covering the delegation model, `agents email` and `ignore-checks`.

## Files to Change
- `cli/lib/help.js`, `cli/spec/lib/help_spec.js` — shortcut help.
- `cli/README.md` — the shortcuts section.
- `docs/agents/architecture/arcanum-cli.md`, `docs/guides/arcanum-cli.md` (both from #780) — the shortcuts sections.
