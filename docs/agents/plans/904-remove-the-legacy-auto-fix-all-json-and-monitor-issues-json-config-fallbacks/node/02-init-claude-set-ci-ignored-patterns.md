# InitClaudeSetCiIgnoredPatterns

- Delete `LEGACY_CONFIG_FILE`, and call `this._writer.write` without a `legacyFile`.
- Update the class JSDoc: the command no longer seeds from `auto-fix-all.json`.
- In `InitClaudeSetCiIgnoredPatterns_spec.js`, replace "seeds from the legacy auto-fix-all.json when the namespace is absent" with a case where the legacy file is present and ignored: the namespace holds only `ignored_check_patterns`.

## Files to Change

- `core/lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns.js`: drop the legacy seed.
- `core/spec/lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns_spec.js`: replace the seed case with an "ignored" case.
