# Arcanum CLI: Key Registry

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the shared, machine-readable registry of known arcanum config keys. The CLI uses it to validate writes and to drive listing, help, the wizard and the shortcuts. Arcanum's own code and docs can use the same definitions.

## Decisions

### Entry shape

The registry has one entry per key or key pattern. Patterns use wildcard segments, such as `git.agents.<agent>` or `next_step.auto.<skill>`. Each entry has:

- **type**: string, boolean, number, array, or an enum of allowed values;
- **allowed tiers**: any of global, repo, local;
- **read-only flag**, e.g. for `version` and `migrations.version`;
- **default** value;
- a short **description**;
- an optional **`setup`** field, `{section, order, prompt, instances?}`, for keys the [`config setup` wizard](shortcuts-and-setup.md#arcanum-config-setup-wizard) asks.

The `default` value feeds the `default` field of `config get` and of the shortcuts' reads (see [Command Surface](command-surface.md#json-output)).

The `setup` field:

- The wizard asks exactly the entries that carry it, ordered by `section` (in the canonical order `identity`, `engine`, `git`, `flow`, `ci`), then by `order`. `prompt` is the question shown.
- `instances` lists the concrete names to ask for a wildcard key, e.g. `next_step.auto.<skill>` → `enhance-issue`, `discuss-issue`, `auto-plan-issue`.
- `git.agents.<agent>` is the exception: its instances come from the target repo's `.claude/agents/*.md`, not from the registry.
- Adding a key to the wizard is a registry edit, not CLI code.

### Location

- The registry lives in this repo **outside `cli/`**. It is the single source of truth for arcanum's own code and docs and for the CLI, so it cannot drift from what arcanum actually reads.
- It is **packed into the `arcanum-cli` npm package at build time** by the CLI build step (see [Shared Config Logic](shared-config-logic.md)). The installed CLI is self-contained and never reads the registry from an arcanum install.

### Rule

Adding a config key to arcanum means adding a registry entry. This is a checklist item in the relevant docs.

### Validation

- `config set` and `config unset` check the key, type, enum, tier and read-only-ness against the registry, and refuse with a clear message on any mismatch.
- Unknown keys are refused unless `--force` is passed. `--force` is the escape hatch for keys newer than the installed CLI, and for experimental keys.

### Consumers

The registry drives:

- `config list`: known keys and their descriptions;
- `config setup`: which keys to ask, their types and sensible tiers;
- `--help` key docs;
- the shortcuts, which are thin front-ends over registry entries (see [Shortcuts and Setup](shortcuts-and-setup.md)).

### Seed keys

This table is indicative. The registry issue (#777) finalizes it. Sources: [Shared State & Configuration Files](../../architecture/shared-state-and-configuration.md) and the root `README.md`.

| Key | Type | Notes |
| --- | --- | --- |
| `engine.mode` | enum `shell` / `native` / `docker` | repo or local |
| `git.email` | string | default agent email or `{agent}` pattern |
| `git.agents.<agent>` | string | per-agent email |
| `git.safe_branch` | string | ref, default `origin/main` |
| `git.merge_body_mode` | enum `full` / `empty` / `coauthors` | |
| `next_step.auto.<skill>` | boolean | only JSON `true` enables it |
| `auto-fix-all.ignored_check_patterns` | array of strings | **repo only**; each entry is a case-insensitive regex, validated with `new RegExp(p, 'i')` |
| `auto-fix-all.clear_context` | boolean | local |
| `auto-fix-all.finish_on_empty_queue` | boolean | local |
| `monitor-issues.clear_context` | boolean | local, after #776 |
| `plan-issues.max-retry-count` | number | default 5 |
| `plan-issues.error-sleep-time` | number | seconds, default 5 |
| `version` | string | read-only, repo tier |
| `migrations.version` | string | read-only, local tier |

## Alternatives considered

- **No registry, with a free-form `set`.** Rejected: typos and wrong types would be accepted silently and only fail later, when a skill reads the key.
- **A registry inside `cli/` only.** Rejected: it would drift from what arcanum actually reads, and arcanum's own code and docs could not use it.

## Open points

- File format: a JSON Schema or a simpler JSON table.
- Exact location and owner, e.g. a file under `core/` owned by `node`.
- Wildcard matching rules, e.g. whether `<skill>` must name an existing skill.
- How arcanum's own code consumes the registry, if at all (defaults, validation).
- How the "new key means a registry entry" rule is enforced: a docs checklist only, or a test that scans for config reads.
- Input for #777: the final registry must include the `setup` field and the `instances` list that drive the wizard (see [Shortcuts and Setup](shortcuts-and-setup.md#registry-driven)).
