# Rework config-keys.md
Make `docs/agents/architecture/config-keys.md` point to `keys.json` for per-key data and keep only what the registry can't express.

- Intro: describe the doc as "where each key is read and how resolution works". Say that each key's type, allowed tiers, default tier and default live only in [`shared/lib/config/keys.json`](../../../shared/lib/config/keys.json). Remove the sentence "The main table is temporary… #909 replaces it…".
- Add a short **The registry** section (after the intro, before **Tiers and files**) that:
  - names the fields that matter when looking up a key: `key` (with `<placeholder>` wildcards), `type` (+ `values` / `items` / `min` / `integer` / `format`), `tiers`, `default_tier`, `default`, `description`, `read_only`, `setup`;
  - gives one line per field on what it controls at runtime (for example: `tiers` filters reads in `ConfigChain` / `config_chain_read` and is checked on CLI writes; `default_tier` drives untargeted writes; `default` is the value the CLI reports and is kept equal to the code fallbacks by `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`);
  - links to [Shared State & Configuration → Entry shape](shared-state-and-configuration.md#entry-shape) for the full validation rules, without repeating them;
  - says how to look a key up: open `keys.json`, or run `/arcanum-check-config <key>` / `arcanum config get <key> --all-tiers`.
- Keep **Tiers and files**, **How keys are read** and **Default write tier** as they are. In **Default write tier**, change the sentence that names which keys set `default_tier` ("Only `git.email` and … set `default_tier`") to point to `keys.json`, because that list copies registry data.
- **Settings** table: rename it to **Readers** (or keep the heading, but update any anchors that link to it). Keep one row per key with only the columns `Key | Read via | Reader | Notes`. Remove Type, Tiers, Default tier and Default. Rewrite the lead-in paragraph to match. Drop Notes that only restate tiers ("A value in the repo file is ignored.", "A value in the global file is ignored.", "A local value overrides the repo value."). Keep behavioral notes (for example, case-insensitive matching, how `git.email` / `git.agents` resolve per tier, the auto_next behavior).
- **Version pointers**: keep the table. Replace the closing sentence "`keys.json` registers `version` with `tiers: [\"repo\"]`…" with one that keeps the "separate scopes, not a fallback chain" point and doesn't restate the tiers.
- In `docs/agents/architecture/shared-state-and-configuration.md`, "The key registry" intro: change "For every key's tiers, default and actual reader, see [Config Keys]" to "For every key's actual reader, see [Config Keys]", so it doesn't send readers to a table that no longer has tiers or defaults.
- Grep `docs/` for links to `config-keys.md#settings` and fix them if the heading changes.

## Files to Change
- `docs/agents/architecture/config-keys.md`: intro, a new registry section, the Default write tier sentence, the Settings → Readers table, the Version pointers sentence.
- `docs/agents/architecture/shared-state-and-configuration.md`: one sentence in "The key registry" intro.
