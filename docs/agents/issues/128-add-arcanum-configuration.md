# Issue: Add arcanum configuration

## Description
Today, `.claude/configuration/auto-fix-all.json` holds `auto-fix-all`'s permanent configuration and `.claude/state/auto-fix-all-config.json` holds its temporary/personal configuration — both files are named and shaped specifically for `auto-fix-all`, even though other arcanum features will increasingly need their own configuration.

We want a general, namespaced arcanum configuration mechanism that any feature can use, plus a way for repos that already installed arcanum to pick up structural changes (renamed files, new folders, new config shapes) introduced by later arcanum versions — something the existing `arcanum-update` skill doesn't cover, since it only updates the arcanum install itself, not artifacts inside a consuming repo.

## Problem
- The config file names (`auto-fix-all.json`, `auto-fix-all-config.json`) tie the storage to one feature, so other arcanum features have nowhere natural to put their own config without either colliding with `auto-fix-all`'s or inventing yet another ad-hoc file.
- Multiple scripts independently know the legacy file paths (`auto-fix-all/scripts/config.sh` *and* `auto-fix-all/scripts/wait_ci.sh`, which reads `ignored_check_patterns` directly with its own `jq` call) — any rename has to account for every reader, not just the obvious one.
- There is no mechanism for a repo that already has arcanum installed to be walked through repo-side changes (file renames, new config shapes, new folders) that a newer arcanum version introduces. `arcanum-update` only updates the arcanum skill install itself.

## Expected Behavior
- Arcanum-wide config lives in `.claude/configuration/arcanum-repo-config.json` and `.claude/state/arcanum-config.json`, each feature keeping its own namespaced key (`auto-fix-all` today).
- Repos that haven't migrated yet keep working via a fallback to the legacy files, with a warning pointing at a guide.
- Repos can run a versioned migration system (`arcanum/migrations/repos/<version>/NNN.sh`) to catch up on repo-side changes shipped in newer arcanum versions, with explicit user control (`[A]ll`/`[N]one`/`[S]elect`) over what gets run.

## Solution

### Config rename + fallback
- Read from `.claude/configuration/arcanum-repo-config.json` instead of `.claude/configuration/auto-fix-all.json`.
  - `.claude/configuration/auto-fix-all.json` remains a fallback (used only if `arcanum-repo-config.json` is absent or missing the relevant key). Fallback is controlled in the script that reads the configuration.
  - When the fallback is used, issue a warning that this configuration has moved and needs to be updated, pointing at the guide described below.
- Read from `.claude/state/arcanum-config.json` instead of `.claude/state/auto-fix-all-config.json`, with the same fallback + warning behavior.
- `arcanum-repo-config.json` and `arcanum-config.json` hold a top-level `"auto-fix-all"` key containing exactly what today's flat files hold.

### Naming
- `.claude/configuration/arcanum.json` was **not** used for the new config file — it would echo the *install-root* `arcanum.json` (written by `arcanum/install/installer.sh` / `arcanum/update/updater.sh`, tracks `{version, repo, manifest}` for the arcanum install itself). Different directory, but same filename for a different purpose, which is confusing. Renamed to **`.claude/configuration/arcanum-repo-config.json`**.
- `.claude/state/arcanum-config.json` keeps its originally proposed name — it was never ambiguous with the install-root file.
- The per-repo migration folder is **`arcanum/migrations/repos/<version>/NNN.sh`**, not `arcanum-updates/repos/...` and not something under `.claude/`:
  - Avoids colliding with the existing `arcanum-update` skill (which updates the *arcanum install*, not a consuming repo) — "migrations" alone is unambiguous in this context, no `arcanum-` prefix needed on the folder name.
  - Lives under `arcanum/` (alongside `arcanum/install`, `arcanum/update`, `arcanum/_lib`) rather than `.claude/`, because `.claude/` in the arcanum source repo is dev-only configuration for developing arcanum itself, and is explicitly excluded from release zips (`scripts/build_release_zip.sh` `EXCLUDES`) — it must never ship. `arcanum/` already ships untouched, matching where this needs to end up.

### Shared fallback helper, not per-script duplication
`auto-fix-all/scripts/config.sh` isn't the only reader of the legacy config files — `auto-fix-all/scripts/wait_ci.sh` independently hardcodes `.claude/configuration/auto-fix-all.json` and reads `ignored_check_patterns` with its own direct `jq` call, bypassing `config.sh` entirely. Adding fallback+warning logic only inside `config.sh` would leave `wait_ci.sh` reading exclusively the old file, missing `arcanum-repo-config.json` forever.

Extract a shared helper, e.g. `arcanum/_lib/repo_config.sh`, exposing a generic "read key `X` from `arcanum-repo-config.json`'s `<namespace>` object; if the file/key is absent, fall back to the legacy file at `<path>` and emit the warning" function. Both `config.sh` and `wait_ci.sh` call into it (namespace `auto-fix-all` for both). Any future arcanum feature reading its own namespaced config gets the fallback behavior for free instead of re-implementing it.

### docs in release
- Ship (and pack with releases) a `docs/guides` folder containing an md file explaining this change; when the fallback issues its warning, it points at this file so the user can act (run `init-claude`, run a migration script, or edit manually).
- `scripts/build_release_zip.sh` currently excludes `docs/` wholesale. This needs an explicit carve-out — e.g. exclude `docs/` except `docs/guides/` — since right now the entire `docs/` tree is dropped from every release.
- Add a second guide explaining how the repo's arcanum version is tracked, where it's expected to live (`.claude/configuration/arcanum-repo-config.json`), and how to manually set it (e.g. to skip straight to a later version instead of replaying every migration).

### Init claude
- Update the `init-claude` skill to write to the new config files instead of the old ones (`init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` currently write directly to the legacy files and need updating).
- `init-claude` should also insert into `.claude/configuration/arcanum-repo-config.json` the arcanum version used to configure the repo — this is what lets the migration runner later check the version and apply any needed updates.

### Per-repo migration script system
Add, under `arcanum/migrations/repos/`, shell scripts that update repos that already have arcanum installed:

- Each time a new feature needs a script to update a repo, it's added to `arcanum/migrations/repos/next/` as `001.sh`, `002.sh`, etc. A generator script computes the next filename: `001.sh` if none exist yet, otherwise `(highest existing number) + 1` — never fills a gap left by a deleted/skipped file, since reusing a number a maintainer removed on purpose would be surprising.
- When `bump-version` runs, `arcanum/migrations/repos/next/` is moved to `arcanum/migrations/repos/<version>/`, and a new `arcanum/migrations/repos/next/` is created in its place (with a `.keep` file inside).
- A script checks the repo's current arcanum version (from `.claude/configuration/arcanum-repo-config.json`) and decides which version folders to load, then executes their scripts in order (earliest version first).
  - If the version field is missing entirely (file absent, or file present without a `version` field), treat the version as `0.0.0` and run every available migration — safe, because the very first migration this issue introduces is exactly what brings the repo's config up to the new shape.
  - If the version field is present but not valid semver, hard-error rather than guessing — silently falling back to `0.0.0` risks re-running migrations that were already safely applied. Tell the user the field is invalid and needs manual correction.
- This folder needs to be packed with releases.
- A skill triggers this script.
- Alongside each `NNN.sh`, a matching `NNN.md` explains what the script does, so users can verify before running.
- This is distinct from `arcanum-update`'s existing update scripts, which perform global changes to the arcanum install itself — this new mechanism is aimed at updating one consuming repo at a time.

#### Confirmation flow
The top-level script asks for confirmation:
- **[A]ll** — every migration script runs. Loops over "update per version" for each pending version, passing the version and a flag suppressing further confirmation/listing.
- **[N]one** — migrations do not run this time; the user figures it out later. The recorded version in `arcanum-repo-config.json` is left unchanged — skipping is not applying, so the next run must still detect the same pending migrations and prompt again.
- **[S]elect** — the user goes through a loop of updates per version.

When the version-selection prompt is shown, it displays the currently-detected version. If no version could be detected (the `0.0.0` case above), it shows an explicit warning that *all* migrations will run because no version could be detected, and points at the version-tracking guide mentioned above.

**Select update** (separate script): lists the versions higher than the current one (no validation that the user typed a real version) plus a `[D]one` option. When a version is picked, "update per version" is called for it, still requiring confirmation.

**Update per version** (separate script):
- Confirmation suppressed: runs every file for that version in order.
- Confirmation not suppressed: lists the files and offers:
  - **[A]ll** — every file in this version runs; loops over "update per file" for each, passing version, filename, and a flag suppressing further confirmation.
  - **[N]one** — migrations in this version don't run; the user figures it out later.
  - **[S]elect** — loops through updates per file.

**Update per file** (separate script):
- Confirmation suppressed: executes the file directly.
- Confirmation required: shows the paired `.md` file's content, then offers **[R]un** (execute) or **[S]kip**.

#### Per-migration failure contract
Each migration script supports two invocations:
- `NNN.sh config` — returns a JSON object (extensible; only `skippable: true|false` for now) describing whether a failure of this migration can be swallowed.
- `NNN.sh run` — actually performs the migration.

The runner calls `config` first, then `run`. On failure:
- `skippable: true` — swallow the error, record it, and still advance the recorded version past this migration (the migration is declaring itself safe to consider done even if it failed).
- `skippable: false` — halt the entire run immediately; the recorded version stays frozen at the last version whose migrations all completed cleanly, so the same migration is retried on the next run.
- All swallowed/halting errors for the run are collected and shown to the user at the end of the process, not just logged and hidden.
- Errors are written to `.claude/state/arcanum-errors.json` (not `.claude/configuration/`, which is git-tracked, human-edited settings — `.claude/state/` is gitignored and already holds this kind of generated/runtime data). The file is overwritten on every run — only the most recent run's errors, no unbounded accumulation.
- Since a non-skippable failure means the same migration is re-attempted later, migration scripts should be written to be safe to re-run (idempotent), similar to conventional DB migration systems. Document this expectation alongside the migration contract.

### This issue's own migration
This issue's own config conversion ships as `arcanum/migrations/repos/<version>/001.sh` — the migration runner and the config rename land together:
- `001.sh` copies `.claude/configuration/auto-fix-all.json` into `.claude/configuration/arcanum-repo-config.json` under the `auto-fix-all` key (and the same for the state file), so repos that run it stop relying on the fallback entirely.
- Marked `skippable: true` — the fallback+warning already covers the "not migrated yet" case, so a failed/skipped run of it doesn't break `auto-fix-all`, it just leaves the fallback warning active.
- The runtime fallback+warning stays as the permanent safety net for repos that never run this migration (e.g. picked `[N]one`), not as a temporary stopgap.

### Backward compatibility
- `config.sh`'s CLI surface (`get`/`set`/`is-enabled`/`toggle <key>`) doesn't change for callers — only the storage location moves underneath. No caller-side changes needed in `toggle-clear-context`, `init-claude`, or elsewhere.
- **First-write seeding**: when `set`/`toggle` runs and the new file doesn't exist yet, the write first copies the *entire* legacy file's contents into the new file under the `auto-fix-all` namespace, then applies the touched key on top — rather than creating a new file containing only the touched key. This avoids a permanent split-brain state where some keys live only in the old file and others only in the new one; there's one clean cutover per repo, the first time anything is written.

### Performance & security
- **Locking is required**: any write to `arcanum-repo-config.json` / `arcanum-config.json` — from `config.sh`, from migration scripts, and from the first-write full-copy seeding — must go through the existing `arcanum/_lib/lock.sh` helper, the same one `config.sh` already uses for `set`/`toggle`. A migration racing an unrelated `config.sh set` call must not be able to corrupt the JSON.
- **Unattended blast radius**: `[A]ll` mode runs every pending migration with no further per-file confirmation, a bigger blast radius than arcanum's usual one-tool-call-at-a-time pattern. The A/N/S confirmation gate exists specifically to require one explicit, informed user choice before entering unattended mode — don't simplify it away later.
- Performance is not a real concern — migrations run once per repo, sequentially, bounded by a small number of scripts.

### Update skill
Add a new skill, **`arcanum-migrate`**, that triggers the migration runner — named to parallel `arcanum-update` (which updates the arcanum *install*), while `arcanum-migrate` updates a *consuming repo*.

### Guide filenames
- `docs/guides/arcanum-repo-config.md` — explains the config-file move (legacy → `arcanum-repo-config.json`/`arcanum-config.json`), linked from the fallback warning.
- `docs/guides/arcanum-repo-version.md` — explains how the repo's arcanum version is tracked, where it lives, and how to set it manually.

### Required file change: docs/agents/issue-enhancement.md
As part of implementing this issue, add a "Migration needed?" item to this repo's `docs/agents/issue-enhancement.md` checklist (used by the `enhance-issue` skill), so future issues consider whether their change needs a migration script:

> **Migration needed?** — does this change require a migration script under `arcanum/migrations/repos/<version>/` so repos that already installed arcanum can catch up (e.g. a config file shape change, a renamed/moved file)? If so, note it so the migration ships in the same version as the change it belongs to.

This file change must be committed as part of this issue's PR.

## Benefits
- Configuration becomes arcanum-wide and namespaced instead of hardcoded to `auto-fix-all`, so future features have a natural, non-colliding place to store their own settings.
- Existing repos keep working unmodified via the fallback+warning, while gaining a clear, self-explanatory path (the migration system + guides) to catch up when they're ready.
- Repos gain a general, versioned mechanism to pick up repo-side changes as arcanum evolves, with explicit user control over blast radius (`[A]ll`/`[N]one`/`[S]elect`) rather than silent, unattended file changes.
- Establishes a reusable config-fallback + migration pattern other features can lean on later instead of reinventing it per feature.
