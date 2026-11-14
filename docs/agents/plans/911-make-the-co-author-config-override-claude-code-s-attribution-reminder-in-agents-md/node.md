# Node Plan: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

Main plan: [plan.md](plan.md)

## Shared contracts

This agent produces the `init-claude-ensure-coauthor-policy` command. Its exact policy line, appended block and `COAUTHOR_POLICY=added|present|no-agents-md` output are defined in [plan.md](plan.md#shared-contracts). The scripter's shim and migration rely on that output.

## Implementation Steps

### Step 1 — Add the native command

Add `core/lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy.js`, modelled on `InitClaudeSetNextStepClear.js`. Keep the policy line as one exported constant, so specs and docs can quote a single source. Register the command in `core/lib/core/commands.js` (`context: 'repo'`, native-only). Implement the three cases and the blank-line normalisation exactly as the contract says.

### Step 2 — Specs

- Unit spec `core/spec/lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy_spec.js` covers:
  - no AGENTS.md
  - present (left byte-identical)
  - added to a file with a trailing newline
  - added to a file with no trailing newline
  - added to a file with several trailing blank lines
  - running twice is idempotent
- Bin routing spec `core/spec/bin/initClaudeEnsureCoauthorPolicy_spec.js`, modelled on `initClaudeSetNextStepClear_spec.js`. It runs the real shim end to end in every `engine.mode`. The shim is the scripter's, so add this spec after the scripter step lands, or coordinate.
- Migration contract spec `core/spec/bin/migrationsCoauthorPolicy_spec.js`, modelled on `migrationsDeleteLegacyConfig_spec.js`. Keep the `SCRIPT` path as one full string literal (`arcanum/migrations/repos/next/004.sh`) so `bump-version.sh` can rewrite it. It covers:
  - `config` output
  - `run` adds the line
  - re-run leaves it present
  - no AGENTS.md is a no-op
  - the manifest entry

## Files to Change

- `core/lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy.js` — new command.
- `core/lib/core/commands.js` — register it.
- `core/spec/lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy_spec.js` — unit spec.
- `core/spec/bin/initClaudeEnsureCoauthorPolicy_spec.js` — shim routing spec.
- `core/spec/bin/migrationsCoauthorPolicy_spec.js` — migration contract spec.

## CI Checks

- `core`: `make core-check` (lint + tests; CI jobs for core tests and lint)

## Notes

- `migrationSpecReferences_spec.js` may check that every `next/` migration has a spec. Make sure the new one is picked up.
