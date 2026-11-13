# Scripter Plan: Make CLI config shortcuts take their tier from keys.json

Main plan: [plan.md](plan.md)

## Shared contracts

Implements `key_registry_default_tier <full_key>` (shell mirror of `KeyRegistry#defaultTier`: `default_tier` → only tier → `local` if allowed → first tier; prints nothing for an unknown key). An unregistered key keeps the repo tier file. The resulting files must match the native writer (node) exactly.

## Implementation Steps

### Step 1 — `key_registry_default_tier`

In `arcanum/_lib/key_registry.sh`, extend `_key_registry_lookup`'s jq program, or add a sibling that reuses its entry matching, to print the entry's default tier per the rule. Expose it as `key_registry_default_tier`. Keep it bash 3.2 compatible, silent on stderr, always exit 0, honoring `KEY_REGISTRY_FILE`. Cover it in the existing shell/registry specs (wherever `key_registry_allows_tier` is tested).

### Step 2 — Registry-driven writers in both `config_common.sh`

- In `auto-fix-all/scripts/config_common.sh` and `monitor-issues/scripts/config_common.sh`, replace the hardcoded `case` in `_new_file_for_key` with a `_write_tier_for_key` helper: `key_registry_default_tier "${NAMESPACE}.<key>"`, defaulting to `repo` when empty.
- `config_set_shell.sh` / `config_toggle_shell.sh` (both skills): write through a small dispatcher. local → `repo_config_write .claude/state/arcanum-config.json`; repo → `repo_config_write .claude/configuration/arcanum-repo-config.json`; global → `global_config_write`. The toggle reads its current value the same way it does today.
- `_config_read_value`'s unregistered branch keeps reading the repo file. Keep the `# config-key:` annotations the static scan (`ShellConfigKeyScan_spec.js`) relies on.
- Run the parity specs (`core/spec/bin/autoFixAllConfigParity/*`, `core/spec/bin/monitorIssuesConfigParity/*`) to confirm identical files and output with the native writer.

## Files to Change

- `arcanum/_lib/key_registry.sh` — `key_registry_default_tier`.
- `auto-fix-all/scripts/config_common.sh`, `config_set_shell.sh`, `config_toggle_shell.sh` — registry-driven tier.
- `monitor-issues/scripts/config_common.sh`, `config_set_shell.sh`, `config_toggle_shell.sh` — same.
- `docs/agents/architecture/shared-state-and-configuration.md` — the `.claude/state/arcanum-config.json` row: the writers now pick the file from `keys.json`'s default tier, not a hardcoded key list.

## CI Checks

- `core` (shell parity and scan specs live there): `yarn test` (CI job: `test`); `shellcheck` on the touched scripts.

## Notes

- If the dispatcher would be duplicated in both skills, put it in `arcanum/_lib/` (e.g. `config_write_tier <repo_path> <tier> <namespace> <key> <json>`).
