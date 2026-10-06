# Architect Plan: Fix release

Main plan: [plan.md](plan.md)

## Shared contracts

- After this work, **no** in-scope file (`core/spec/**`, `docs/**`, `README.md`, excluding `docs/agents/issues/**` and `docs/agents/plans/**`) may contain `repos/next/NNN`, because the real `next/` is empty and `bump-version.sh`'s new guard would abort.
- Document the **spec convention** and **doc convention** from [plan.md](plan.md), plus the guard and rewrite behavior.

## Implementation Steps

### Step 1 — Fix the stale `repos/next/NNN` references

Trace each reference to the version folder its migration actually shipped in, and update it. Look at the history of the file the reference points to (`git log --follow --name-status -- arcanum/migrations/repos/*/NNN.*`) together with the issue number the surrounding text cites, and check the target folder's `migrations.json` / `NNN.md` for a matching description. Never apply a blanket replacement: `next/001` has meant different migrations at different times. Known references:

- `docs/agents/architecture/issue-tags.md:25` — shipit permission, `next/001.sh`/`002.sh`/`003.sh`
- `docs/agents/architecture/issue-tags.md:51` — Epic label, `next/001`/`002` → `1.2.0` (cf. `core/spec/bin/migrationsEpicLabel_spec.js`)
- `docs/agents/architecture/script-engine.md:107` and `docs/agents/specs/shell-engine-removal.md:5` — engine.mode deprecation warning (#601)
- `docs/agents/architecture/shared-state-and-configuration.md:11` (`next/001.sh` re-seed) and `:12` (`next/002.sh` re-seed)
- `docs/agents/architecture/dispatch-permissions.md:71` — `next/002.sh`
- `docs/guides/arcanum-repo-version.md:52` — `next/002.sh`
- `docs/agents/architecture/skill-finish.md:126` and `docs/agents/architecture/shared-state-and-configuration.md:40` — folder-only "migrations in `arcanum/migrations/repos/next/`" that mean the auto-next migrations, now `repos/2.0.0/001.sh`–`003.sh`. Rewrite them to cite the specific files.

Also review `shared-state-and-configuration.md` rows 12 and 17. They say values are "seeded by a future per-repo migration (in `arcanum/migrations/repos/next/` … `001`/`002` there are already claimed by …)". That parenthetical is stale. Rephrase it without claiming specific `next/` ids, and keep the "future migration" intent.

Finish with `grep -rnE 'repos/next/[0-9]{3}([^0-9]|$)' core/spec docs README.md | grep -v '^docs/agents/issues/\|^docs/agents/plans/'`, which must return nothing.

### Step 2 — Document the conventions and the bump-time behavior

In `docs/agents/architecture/per-repo-migrations.md`, extend the **Layout** paragraph (or add a short subsection right after it, e.g. "Referencing pending migrations") stating:

- `scripts/bump-version.sh` first **aborts** if any in-scope doc or spec cites `repos/next/NNN` for a file that doesn't exist in `next/`. Then, when it rolls `next/` into `<new-version>/`, it **rewrites** `repos/next/NNN` → `repos/<new-version>/NNN` for the moved files. Scope: `core/spec/**`, `docs/**`, `README.md`; excluding `docs/agents/issues/**` and `docs/agents/plans/**`, which are historical records.
- **Doc convention:** cite the specific file (`arcanum/migrations/repos/next/001.sh`), never just the `next/` folder, when referring to a pending migration.
- **Spec convention:** name each migration file with one string literal holding the full relative path. Don't assemble `'repos', 'next'` and append ids.

Also add one line to `docs/agents/issue-enhancement.md`'s **Migration needed?** bullet, pointing at these conventions.

## Files to Change

- `docs/agents/architecture/issue-tags.md`, `script-engine.md`, `shared-state-and-configuration.md`, `dispatch-permissions.md`, `skill-finish.md` (all under `docs/agents/architecture/`) — stale references traced and fixed.
- `docs/agents/specs/shell-engine-removal.md`, `docs/guides/arcanum-repo-version.md` — stale references traced and fixed.
- `docs/agents/architecture/per-repo-migrations.md` — guard, rewrite and conventions.
- `docs/agents/issue-enhancement.md` — pointer to the conventions.

## Notes

- If a reference can't be traced with confidence, prefer rewording it to name the migration by issue number and description (e.g. "the `next_step.auto` migrations from #716, shipped in 2.0.0") rather than guessing a folder.
