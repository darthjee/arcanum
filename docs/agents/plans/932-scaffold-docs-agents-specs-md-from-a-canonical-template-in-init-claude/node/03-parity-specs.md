# Parity specs

In `initClaudeSetupDocsStructureParity_spec.js`, add `docs/agents/specs.md` and `docs/agents/specs/.gitkeep` to `PATHS`, and add parity cases for: an existing `specs.md` (note on stderr), a non-empty `specs/` directory, `docs/agents/specs` as a file, and `AGENTS.md` with a Documentation section lacking the specs link. Each case asserts identical stdout, stderr, exit code and files.

## Files to Change
- `core/spec/bin/initClaudeSetupDocsStructureParity_spec.js` — new paths and cases.
