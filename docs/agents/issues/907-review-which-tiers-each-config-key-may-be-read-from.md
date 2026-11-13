# Issue: Review which tiers each config key may be read from

## Description

Part of #900. Its dependencies are merged: reads are now driven by `keys.json` (#902, #903, #905), the legacy fallbacks are gone (#904, #906), and today's tiers are documented in `docs/agents/architecture/config-keys.md` (#901).

Go through the keys whose `tiers` in `shared/lib/config/keys.json` are limited, and fix the ones that are wrong. Since reads follow the registry, each change is an edit to `keys.json`, plus specs, docs and a warning migration.

## Problem

Several keys are allowed in one tier only, so a value placed elsewhere is silently ignored. In the ward session, `git.safe_branch` in the global file and `auto-fix-all.clear_context: true` in the global file had no effect. These are personal preferences or project facts where the narrow tier is not justified.

Also, `migrations.version` is declared `tiers: ["local"]`, but the same dotted key also lives in the global config file as the global migration-scope pointer (`global_config_get_version` / `global_config_set_version` in `arcanum/_lib/global_config.sh`, seeded by migration `0.15.0/002`). It is legitimate, not a misplaced key (this also answers that part of #912), but the registry does not describe it.

## Expected Behavior

Decided tiers:

| Key | Tiers today | New tiers | Default write tier |
| --- | --- | --- | --- |
| `git.safe_branch` | local | global, local | local (rule 3, no `default_tier` needed) |
| `auto-fix-all.clear_context` | local | global, local | local |
| `auto-fix-all.finish_on_empty_queue` | local | global, local | local |
| `monitor-issues.clear_context` | local | global, local | local |
| `auto-fix-all.ignored_check_patterns` | repo | repo, local | repo, via a new `default_tier: "repo"` (otherwise rule 3 would move writes from `init-claude` / `config setup` ci to local) |
| `migrations.version` | local | global, local | — (read-only) |
| `version` | repo | repo (unchanged) | — (read-only) |

All other keys already allow all three tiers and stay as they are.

- The repo tier stays excluded for `git.safe_branch` and the three workflow keys: a value there is still ignored, and `/arcanum-check-config` / `arcanum config get --all-tiers` keep reporting it as `ignored: tier not allowed`.
- Default write tiers of the toggle skills (`/toggle-clear-context`, `/toggle-monitor-clear-context`) and of `config setup` do not change.
- `migrations.version` stays read-only, so CLI behavior does not change. The migrations runner keeps reading each pointer from its own file (local and global are separate scopes, not a fallback chain); this must stay true — no runner code may start resolving `migrations.version` through the chain.

## Solution

1. **`keys.json`** (owner: shared): apply the table above, including `default_tier: "repo"` on `auto-fix-all.ignored_check_patterns`. Update the registry specs and the defaults drift spec as needed.
2. **Warning migration** (owner: scripter): values that used to be ignored now take effect, so add migrations under `arcanum/migrations/repos/next/` that **only warn** — they list the now-effective values and never change any file:
   - a `"global"`-scoped entry: in the global config file, report any `git.safe_branch`, `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context` value (e.g. ward's global `auto-fix-all.clear_context: true` would start applying);
   - a `"local"`-scoped entry: in `.claude/state/arcanum-config.json`, report any `auto-fix-all.ignored_check_patterns` value, which now overrides the repo value.
   Each warning names the key, the file, the value, and how to remove it if it is unwanted. Nothing found means a silent no-op. Skippable.
3. **Docs** (owner: architect): update the Settings table in `docs/agents/architecture/config-keys.md` (tiers, default tier, the "A value in the repo or global file is ignored" notes), the "Only `git.email` and `git.agents.<agent>` set `default_tier`" sentence, and `docs/guides/arcanum-global-config.md` (the `migrations.version` pointer is now registered for the global tier). Mention the behavior change in the release notes.

## Benefits

- A personal default (safe branch, clear-context, finish-on-empty-queue) can be set once globally instead of in every clone.
- A developer can override the CI ignore patterns locally without touching the committed config.
- The registry describes every place each key lives, including the global migrations pointer.
- Users are told when a value they had set but that was ignored starts taking effect, instead of being surprised.
