# Guide: The Arcanum Repo Config Move

If you see a warning like:

```
Warning: reading '<key>' from legacy config file <legacy-file> — this configuration has moved to <new-file>. See docs/guides/arcanum-repo-config.md.
```

...this repo's arcanum-managed configuration is still living in the old, feature-specific files instead of the new, namespaced ones. Nothing is broken — the fallback keeps working indefinitely — but it's worth catching up.

## What changed

Arcanum configuration used to live in files named after the one feature that used them:

| Old (legacy) file | New file |
|---|---|
| `.claude/configuration/auto-fix-all.json` | `.claude/configuration/arcanum-repo-config.json` |
| `.claude/state/auto-fix-all-config.json` | `.claude/state/arcanum-config.json` |

The new files are shared across every arcanum feature, each keeping its own key inside them — e.g. everything `auto-fix-all` reads/writes lives under a top-level `"auto-fix-all"` key:

```json
{
  "auto-fix-all": {
    "ignored_check_patterns": ["Codacy"]
  }
}
```

This lets future arcanum features store their own settings (under their own key) without colliding with `auto-fix-all`'s, or inventing yet another ad-hoc file.

## The fallback

Every script that reads this configuration (`auto-fix-all/scripts/config.sh`, `auto-fix-all/scripts/wait_ci.sh`, and any future reader going through `arcanum/_lib/repo_config.sh`) checks the new file first. If the key it needs isn't there, it falls back to the legacy file and prints the warning above — so nothing you had configured stops working after upgrading arcanum, you just won't see the warning go away until you migrate.

## How to migrate

Two ways, either is fine:

1. **Run `/arcanum-migrate`** — the migration this issue shipped (`arcanum/migrations/repos/*/001.sh`) copies both legacy files' contents into the new ones under the `auto-fix-all` key, then leaves the legacy files in place (harmless — they're just no longer read once the new file has the key). This is safe to re-run.
2. **Re-run `/init-claude`** — `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` already write straight to the new files going forward, so re-running those steps has the same effect for the keys they manage.

You can also edit `.claude/configuration/arcanum-repo-config.json` / `.claude/state/arcanum-config.json` by hand — just nest whatever you're adding under the right feature's key.

## Per-repo migrations use this same pair of files, for two independent version pointers

The top-level `.version` field on `arcanum-repo-config.json` (committed, shared via git) and the namespaced `.migrations.version` field on `arcanum-config.json` (gitignored, local per clone) each track how far this repo/clone has caught up on `arcanum/migrations/repos/<version>/migrations.json`'s entries — one pointer per entry `applies_to` scope (`"repo"` or `"local"`). See `docs/guides/arcanum-repo-version.md` for why there are two pointers instead of one, and `docs/agents/architecture/per-repo-migrations.md` for the full `migrations.json` schema.

`type: "instructions"` entries additionally rely on `.claude/state/arcanum-migrations-ledger.json` for per-entry resume tracking — deliberately *not* part of this config-file pair (it isn't a version pointer and doesn't route through `repo_config.sh`); see `docs/guides/arcanum-repo-version.md`'s "A third tracker" section.

## A third, global tier on top of this pair

Both files described above are repo-scoped — neither survives outside
the repo it lives in. There's also a third, outermost tier, global and
cross-project (scoped to your Claude Code account/profile instead of
any one repo), consulted only when neither of these two has a value
for a given key. See [`arcanum-global-config.md`](arcanum-global-config.md)
for the full resolution order and how to set it.
