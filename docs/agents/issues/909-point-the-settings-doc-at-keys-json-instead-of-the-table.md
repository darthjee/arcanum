# Issue: Point the settings doc at keys.json instead of the table

## Description
Part of #900. Config reads now go through the `keys.json` registry (#902, #903, #905). So `docs/agents/architecture/config-keys.md` should stop restating what `shared/lib/config/keys.json` already declares, and should point to it as the single source of truth. This also settles the open point from #901: the user guides keep their own type/default columns today, and they shouldn't.

## Problem
- `config-keys.md`'s **Settings** table copies the Type, Tiers, Default tier and Default of each key from `keys.json`. Its intro already calls the table temporary and says #909 replaces it.
- `docs/guides/arcanum-repo-config.md` ("Documented keys": the `git.*` and `next_step.auto.*` tables) lists Type/Default/Chain a second time.
- `docs/guides/arcanum-global-config.md` ("Which keys use it") lists in prose which keys allow the global tier.
- Each change to `keys.json` (such as #907's tier review) has to be repeated in up to three docs, and the copies can drift.

## Expected Behavior
- `config-keys.md` names `shared/lib/config/keys.json` as the single source of truth for each key's type, allowed tiers, default tier and default.
- It has a section that explains the registry's fields:
  - `format_version`
  - per key: `key` (including `<placeholder>` wildcards), `type` (+ `values`, `items`, `min`, `format`), `tiers`, `default_tier`, `default`, `description`, `read_only`
  - `setup` (`section`, `order`, `prompt`, `instances`)
- Each field links to the code that uses it (`KeyRegistry`, `validateRegistry`, `key_registry.sh`, the setup wizard, the defaults drift spec).
- The **Tiers and files** mapping, **How keys are read** and **Default write tier** sections stay. They describe mechanisms, not per-key data.
- The **Settings** table keeps one row per key, but only the Key, Read via, Reader and Notes columns. The Type, Tiers, Default tier and Default columns are removed. Where a Note only restated tiers ("A value in the repo file is ignored."), it is dropped or rewritten so it doesn't repeat `keys.json`.
- The "The main table is temporary…" sentence is removed.
- The **Version pointers** section stays. Its `keys.json` sentence is kept only if it doesn't restate tiers that the reader can look up.
- `arcanum-repo-config.md` "Documented keys": the `git.*` and `next_step.auto.*` tables keep their per-key behavioral notes. The Type, Default and Chain columns are removed, with a link to `config-keys.md` / `keys.json` for those.
- `arcanum-global-config.md` "Which keys use it": no longer lists which keys allow or don't allow the global tier. It points to `keys.json`'s `tiers` (via `config-keys.md`) and keeps only the prose that is specific to the global tier (the migration notes).
- No code or `keys.json` changes. The work is docs only.

## Solution
- **Owner:** architect (docs under `docs/agents/architecture/` and `docs/guides/`).
- Rejected alternatives:
  - A table generated from `keys.json` (a script or `arcanum config list --markdown`, plus a drift spec): adds tooling for little gain once the docs no longer copy the data.
  - A plain pointer with no table: would lose the Reader/Notes information, which `keys.json` doesn't hold.
- Depends on #902, #903 and #905 (merged) and on #907 (merged).

## Benefits
- Changing a key's type, tiers or default needs an edit to `keys.json` only. No doc table can go stale.
- The docs still say where each key is read in code, which `keys.json` can't express.
