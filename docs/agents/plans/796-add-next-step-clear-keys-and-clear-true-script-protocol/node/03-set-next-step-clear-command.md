# Shared writer base and InitClaudeSetNextStepClear

Extract the body of `InitClaudeSetNextStepAuto` into a parametrized base
`core/lib/commands/init-claude/InitClaudeSetNextStepKey.js` (constructor/static config
for the key prefix — `auto`/`clear` —, the output tag — `NEXT_STEP_AUTO`/
`NEXT_STEP_CLEAR` — and the usage line). Same `SKILLS`, strict `true|false`
validation, `RepoConfigWriter.write` into
`.claude/configuration/arcanum-repo-config.json` with `legacyFile: ''`.

- `InitClaudeSetNextStepAuto` becomes a thin subclass; behavior, messages and output
  unchanged (its existing specs must pass untouched).
- New `InitClaudeSetNextStepClear` subclass: key `clear.<skill>`, output
  `NEXT_STEP_CLEAR=<skill>=<value>\n`, usage
  `Usage: set_next_step_clear.sh <repo_path> <skill> <true|false>`.
- Register `init-claude-set-next-step-clear` in `core/lib/core/commands.js` (same
  shape as the auto entry: `context: 'repo'`, `validateRepoPath: false`).

Specs: `core/spec/lib/commands/init-claude/InitClaudeSetNextStepClear_spec.js`
(mirror the auto spec), a base spec if the base has logic not covered by the two
subclasses, and the registry entry in `core/spec/lib/core/commands_spec.js`.

## Files to Change
- `core/lib/commands/init-claude/InitClaudeSetNextStepKey.js` — new shared base.
- `core/lib/commands/init-claude/InitClaudeSetNextStepAuto.js` — thin subclass.
- `core/lib/commands/init-claude/InitClaudeSetNextStepClear.js` — new subclass.
- `core/lib/core/commands.js` — register `init-claude-set-next-step-clear`.
- `core/spec/lib/commands/init-claude/InitClaudeSetNextStepClear_spec.js` — new.
- `core/spec/lib/core/commands_spec.js` — new registry entry.
