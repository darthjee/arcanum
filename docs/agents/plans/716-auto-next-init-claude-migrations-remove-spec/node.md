# Node Plan: Auto-next: init-claude, migrations, remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- **Dotted keys**: `RepoConfigWriter.write({ newFile, legacyFile, namespace, key, value })` treats a dotted `key` as a nested path under `namespace`. A flat key is unchanged. This matches the shell `repo_config_write` after the scripter's change.
- **Native-only command `init-claude-set-next-step-auto`**:
  - The shim is `init-claude/scripts/set_next_step_auto.sh <repo_path> <skill> <true|false>`, using `engine_dispatch --native-only`.
  - It writes `next_step.auto.<skill>` into `<repo_path>/.claude/configuration/arcanum-repo-config.json`.
  - Success prints `NEXT_STEP_AUTO=<skill>=<true|false>` and exits `0`.
  - Usage errors (a missing argument, an unknown skill, a value other than `true`/`false`) go to stderr and exit `1`.
  - The allowed skills are `enhance-issue`, `discuss-issue` and `auto-plan-issue`.
- **Migrations** `next/001`–`003` (written by the scripter): `config` prints `{"skippable": true}`, and with no TTY `run` writes nothing and exits `0`.

## Implementation Steps

### Step 1 — Dotted keys in `RepoConfigWriter` and the native-only command

- In `core/lib/utils/config/RepoConfigWriter.js`, make the `section[key] = value` write path-aware. Split `key` on `.`, create the missing intermediate objects and set the leaf. Keep the existing behavior for flat keys and the existing locking.
- Add `core/lib/commands/init-claude/InitClaudeSetNextStepAuto.js`, following `InitClaudeSetCiIgnoredPatterns.js` for repo-config writes and `ArcanumCheckConfig.js` for native-only registration and validation.
- Register the `init-claude-set-next-step-auto` command wherever `arcanum-check-config` is registered.
- Add the shim `init-claude/scripts/set_next_step_auto.sh`, modeled on the `arcanum-check-config/scripts/` shim. It calls `engine_dispatch "$REPO_PATH" init-claude-set-next-step-auto "" --native-only -- "$REPO_PATH" "$SKILL" "$VALUE"`, with usage checks before dispatch. It is in `init-claude/scripts/`, so check with the scripter that it fits that folder's conventions; it is a thin shim only.

### Step 2 — Specs

- `core/spec/lib/utils/config/RepoConfigWriter_spec.js` (extend or create): a dotted key creates nested objects, keeps siblings (an existing `next_step.auto.discuss-issue` survives a write to `auto.enhance-issue`), and flat keys behave as before.
- `core/spec/lib/commands/init-claude/InitClaudeSetNextStepAuto_spec.js`: writes `true` and `false`, creates the file and folder when they are missing, prints `NEXT_STEP_AUTO=...`, and rejects an unknown skill, a bad value and missing arguments with exit `1`.
- A bin-level routing spec for the native-only shim in every `engine.mode`, like `core/spec/bin/arcanumCheckConfig_spec.js`.
- A contract spec for the migrations, `core/spec/bin/migrationsNextStepAuto_spec.js`, modeled on `core/spec/bin/migrationsEpicLabel_spec.js`. It runs `next/001.sh`, `002.sh` and `003.sh` against a temp repo, with `CLAUDE_CONFIG_DIR` pointed at a temp dir for `003`. It asserts that `config` prints `{"skippable": true}` and that `run` without a TTY writes nothing and exits `0`. Run it detached from a controlling terminal (e.g. `setsid`, or however the existing specs make `/dev/tty` unopenable). If `/dev/tty` cannot be made reliably unavailable, cover only `config` and say so in the PR.
- Optionally, cover the shell writers' dotted-key behavior from a spec that sources `arcanum/_lib/repo_config.sh` and `global_config.sh` through bash, if similar specs already do this.

## Files to Change

- `core/lib/utils/config/RepoConfigWriter.js`: dotted-key writes.
- `core/lib/commands/init-claude/InitClaudeSetNextStepAuto.js`: the new native-only command.
- The command registry or dispatcher file where `arcanum-check-config` is registered: register the new command.
- `init-claude/scripts/set_next_step_auto.sh`: the native-only shim.
- `core/spec/lib/utils/config/RepoConfigWriter_spec.js`, `core/spec/lib/commands/init-claude/InitClaudeSetNextStepAuto_spec.js`, a routing spec under `core/spec/bin/`, and `core/spec/bin/migrationsNextStepAuto_spec.js`.

## CI Checks

- `core/`: `yarn test` (CI job: tests), `yarn lint` (CI job: lint).

## Notes

- Native-only commands are not listed in `arcanum/_lib/migration-status.json` (see [Script Engine](../../architecture/script-engine.md#native-only-entrypoints)).
- The migration spec depends on the scripter's migration scripts, so write it after those land on the branch.
