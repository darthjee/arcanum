# Plan: Point the settings doc at keys.json instead of the table

Issue: [909-point-the-settings-doc-at-keys-json-instead-of-the-table.md](../../issues/909-point-the-settings-doc-at-keys-json-instead-of-the-table.md)

## Overview
A docs-only change. It removes the per-key type, tier, default-tier and default data that the config docs copy from `shared/lib/config/keys.json`, and points readers to the registry as the single source of truth. Information that `keys.json` doesn't hold stays in the docs: which code reads each key (Read via / Reader) and its behavioral notes.

## Context
- #902, #903 and #905 made every JS and shell read and every write go through `keys.json` (`tiers`, `default_tier`). #907 reviewed the tiers.
- `docs/agents/architecture/config-keys.md`'s **Settings** table still has Type / Tiers / Default tier / Default columns. Its intro says the table is temporary until #909.
- `docs/guides/arcanum-repo-config.md` ("Documented keys") has three tables (`git.*`, `next_step.auto.*`, `next_step.clear.*`) with Type / Default / Chain columns.
- `docs/guides/arcanum-global-config.md` ("Which keys use it") lists in prose which keys do or don't allow the global tier.
- The registry's field format is already documented in `docs/agents/architecture/shared-state-and-configuration.md` → "The key registry" → "Entry shape". `config-keys.md` should summarize and link to it, not explain each field again.
- Owner: architect. No code, `keys.json` or spec changes.

## Steps

- [01 — Rework config-keys.md](plan/01-config-keys-doc.md)
- [02 — Trim the repo-config guide tables](plan/02-repo-config-guide.md)
- [03 — Trim the global-config guide](plan/03-global-config-guide.md)

## CI Checks
- No code changes, so the CI jobs are unaffected. Check the edited docs for broken relative links and anchors by hand (for example, `grep -n "config-keys.md#" -r docs`).

## Notes
- The Version pointers section in `config-keys.md` stays: file / written-by / read-by aren't in `keys.json`.
- Keep the `[Config Keys](../agents/architecture/config-keys.md)` link lines in both guides. They become the place readers go for type, tiers and default.
- Wildcard keys (`git.agents.<agent>`, `next_step.auto.<skill>`, `next_step.clear.<skill>`) keep one row each in the Reader table, as today.
