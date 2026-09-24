# Unit and parity specs

**Unit spec**: `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js`, modeled on `InitClaudeSetupTemplates_spec.js`, using a temp dir as `repoPath`. Cover:
- a fresh dir with `AGENTS.md`: all six files created (check exact contents; `.gitkeep` is `\n`), the section appended, and exact stdout;
- a re-run: everything skipped, `AGENTS.md` unchanged, and the "already present" line;
- a partial setup: a mix of created and skipped paths, in the fixed order;
- an existing directory at one of the file paths: that path is skipped;
- `AGENTS.md` missing: the warning goes to the injected stderr, there is no `AGENTS.md:` line, and no `AGENTS.md` is created;
- `AGENTS.md` that already has a `## Documentation Guide` heading: treated as present.

**Parity spec**: `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js`, modeled on `initClaudeSetupTemplatesParity_spec.js` and reusing `core/spec/support/utils/initClaudeParity.js` (`createParityDirs`, `runInitClaudeBoth({ script: 'setup_docs_structure', command: 'init-claude-setup-docs-structure', ...dirs })`, `seedFiles`, `expectInitClaudeParity`). Scenarios:
- fresh repo (seeded `AGENTS.md`);
- re-run on an already set-up repo (run twice, assert parity on the second run);
- partially set-up repo (seed some docs files and an `AGENTS.md` that already has the section);
- repo without `AGENTS.md` (asserts the stderr warning matches on both sides).

## Files to Change
- `core/spec/lib/commands/init-claude/InitClaudeSetupDocsStructure_spec.js` — new unit spec.
- `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js` — new parity spec.
