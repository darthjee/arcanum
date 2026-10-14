# Write key-registry.md

Create `docs/agents/specs/arcanum-cli/key-registry.md`, restating #767's "Key registry" decisions.

Decisions to capture:

- One shared, machine-readable registry of known config keys, one entry per key or key pattern (wildcard segments like `git.agents.<agent>`, `next_step.auto.<skill>`), each with: type (string / boolean / number / array / enum values), allowed tiers, read-only flag, default, short description.
- Lives in this repo **outside `cli/`** as the single source of truth for arcanum's own code/docs and the CLI.
- **Packed into the `arcanum-cli` package at build time** by the CLI build — the installed CLI never reads it from an arcanum install.
- Rule: adding a config key to arcanum means adding a registry entry.
- `config set` / `unset` validate key, type, enum, tier and read-only-ness; unknown keys refused unless `--force` (escape hatch for keys newer than the CLI, or experimental ones).
- Drives `config list`, `config setup`, `--help` key docs and the shortcuts.
- Seed table of the currently known keys (from `docs/agents/architecture/shared-state-and-configuration.md` and the scripts): `engine.mode`, `git.email`, `git.agents.<agent>`, `git.safe_branch`, `git.merge_body_mode`, `next_step.auto.<skill>`, `auto-fix-all.ignored_check_patterns` / `clear_context` / `finish_on_empty_queue`, `monitor-issues.clear_context` (after #776), `plan-issues.max-retry-count` / `error-sleep-time`, read-only `version` / `migrations.version`. Mark the table as indicative; #772 finalizes it.

Alternatives considered: no registry (free-form `set` — typos and wrong types accepted silently); registry living inside `cli/` only (drifts from arcanum).

Open points: file format (JSON Schema vs. a simpler JSON table) and exact location/owner (e.g. under `core/`, owned by `node`); wildcard matching rules; how arcanum's own code consumes it; how the "new key ⇒ registry entry" rule is enforced (docs checklist vs. a test).

## Files to Change
- `docs/agents/specs/arcanum-cli/key-registry.md` — new part.
