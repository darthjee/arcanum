# Native implementation

In `InitClaudeSetupDocsStructure.js`:

- Add a `templatePath` constructor dependency, defaulting to `(name) => resolveInstallPath('init-claude', 'templates', name)` (import from `../../utils/file/InstallRoot.js`, as `InitClaudeSetupTemplates.js` does).
- After the existing `FILES` loop, handle `docs/agents/specs.md` (copy the template bytes, or skip it and write the `Note:` line to the injected `stderr`) and `docs/agents/specs/.gitkeep` (the missing/empty/non-empty/non-directory rules, using `readdir` for the emptiness check), keeping the shared-contract list order and messages.
- Replace the embedded `DOCUMENTATION_SECTION` constant: append `'\n' + <template contents>` to `AGENTS.md`.
- When the heading is present and `contents.includes('docs/agents/specs.md')` is false, write the `Warning:` line to stderr after any per-file messages.
- Update the class/JSDoc comments to describe the new files and messages.

## Files to Change
- `core/lib/commands/init-claude/InitClaudeSetupDocsStructure.js` — new entries, template-based section, note and warnings, `templatePath` dependency.
