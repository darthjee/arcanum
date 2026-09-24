# Register the command

Add `'init-claude-setup-docs-structure'` to `core/lib/core/commands.js` next to `init-claude-setup-templates`, with `module: 'commands/init-claude/InitClaudeSetupDocsStructure.js'`, `method: 'run'`, `context: 'repo'`, `validateRepoPath: false`. Update `core/spec/lib/core/commands_spec.js` in the three places `init-claude-setup-templates` appears (the command-name lists and the name → class map).

## Files to Change
- `core/lib/core/commands.js` — new registry entry.
- `core/spec/lib/core/commands_spec.js` — cover the new entry.
