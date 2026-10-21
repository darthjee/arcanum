# Issue: Consolidate monitor-issues clear_context into the shared configuration

## Description
Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic and `docs/agents/specs/arcanum-cli.md` ("Related work") for the full design decisions.

`monitor-issues`' `clear_context` toggle lives in its own file, `.claude/state/monitor-issues-config.json`, outside the three-tier config chain. Move it into the shared configuration as `monitor-issues.clear_context` in `.claude/state/arcanum-config.json`, so the CLI only ever deals with the three-tier files.

**Dependencies:** after the spec sub-issues and the key registry (#777). Before the `cli/` scaffold and the shortcuts sub-issue (`arcanum config monitor-issues clear-context`).

**Owner:** `scripter` (shell side and migration), `node` (`core/lib` side and specs), `skill-writer` only if skill text changes, and `architect` for the docs.

## Problem
- `monitor-issues/scripts/config_common.sh` routes `clear_context` to `.claude/state/monitor-issues-config.json`, with every other key in `.claude/configuration/monitor-issues.json`. Both are flat, non-namespaced files that the shared `repo_config_*` helpers and `ConfigChain` don't know about.
- `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` mirrors the same layout and guards writes with its own `.claude/state/monitor-issues-config.lock`.
- `auto-fix-all` was already moved onto the namespaced files (`auto-fix-all/scripts/config_common.sh`, `AutoFixAllConfig.js`). `monitor-issues` is the only config toggle still outside the tiers.
- The key registry (`docs/agents/specs/arcanum-cli/key-registry.md`) lists `monitor-issues.clear_context` (boolean, local only, default `false`) as **added together with #776 only**.

## Expected Behavior
- `monitor-issues/scripts/config.sh {get|is-enabled|set|toggle} clear_context` reads and writes `.monitor-issues.clear_context` in `.claude/state/arcanum-config.json`, in both the shell and native engines, with identical output.
- `clear_context` has **no** read-time fallback to the legacy `.claude/state/monitor-issues-config.json`. A non-skippable migration is what carries the value forward, as with `auto-fix-all.clear_context`.
- Any other key mirrors `auto-fix-all`: it is stored under the `monitor-issues` namespace in `.claude/configuration/arcanum-repo-config.json`, with `.claude/configuration/monitor-issues.json` as the legacy read/seed fallback through `repo_config_read`/`repo_config_write`.
- The CLI shape doesn't change: `config.sh` stays cwd-relative (no `<repo_path>` argument). `monitor-issues/SKILL.md` and `/toggle-monitor-clear-context` keep calling it exactly as today.
- After running `/arcanum-migrate`, an existing per-clone `clear_context` value appears as `monitor-issues.clear_context` in `.claude/state/arcanum-config.json`. The legacy file and `monitor-issues-config.lock` are left in place, untouched, and are documented as obsolete.

## Solution
- **Shell (`scripter`):** rework `monitor-issues/scripts/config_common.sh` along the lines of `auto-fix-all/scripts/config_common.sh`: `NAMESPACE="monitor-issues"`, `_new_file_for_key` (`clear_context` → `.claude/state/arcanum-config.json`, else `.claude/configuration/arcanum-repo-config.json`), and `_legacy_file_for_key` (`clear_context` → `""`, else `.claude/configuration/monitor-issues.json`). Switch `config_{get,is_enabled,set,toggle}_shell.sh` to `repo_config_read`/`repo_config_write`, which take over locking from the dedicated `monitor-issues-config.lock`. Add `# config-key: monitor-issues.clear_context` annotations where the registry drift check needs them.
- **Native (`node`):** rework `MonitorIssuesConfig.js` to match `AutoFixAllConfig.js` (namespaced files, shared config helpers, no own lock), and update its unit spec and the shell/native parity spec (`core/spec/bin/monitorIssuesConfigParity/`), plus any docker/engine-dispatch specs that assert the old paths.
- **Registry (`node`):** add `monitor-issues.clear_context` to `core/lib/utils/config/keys.json` (boolean, local only, default `false`, no `setup` entry) and drop the "added together with #776 only" note from `key-registry.md`.
- **Migration (`scripter`):** add `arcanum/migrations/repos/next/NNN.sh` and `NNN.md` (`type: script`, `applies_to: "local"`, `skippable: false`) running `repo_config_seed .claude/state/arcanum-config.json .claude/state/monitor-issues-config.json monitor-issues`. It is idempotent, never deletes the legacy file, and is registered in `next/migrations.json`. If the repo-side `monitor-issues.json` legacy file needs seeding too, add it as a separate `applies_to: "repo"` entry (skippable, since the read fallback stays for those keys). Docs cite the specific `next/NNN.sh` file, per "Referencing pending migrations" in `docs/agents/architecture/per-repo-migrations.md`.
- **Skill (`skill-writer`, only if needed):** `/toggle-monitor-clear-context` should need no change, since the CLI is unchanged. Check its wording anyway.
- **Docs (`architect`):** update `docs/agents/architecture/shared-state-and-configuration.md`: mark `.claude/state/monitor-issues-config.json` and its lock as legacy/obsolete, and document `monitor-issues.clear_context` under `.claude/state/arcanum-config.json`. Also update any guide that describes the old layout (e.g. `docs/guides/arcanum-repo-config.md`, README).

## Benefits
- All arcanum config toggles live in the three-tier files, so the upcoming `arcanum` CLI (and `arcanum config monitor-issues clear-context`) needs no special case.
- `monitor-issues` uses the same helpers, locking and registry as `auto-fix-all`, which removes a parallel config implementation.
