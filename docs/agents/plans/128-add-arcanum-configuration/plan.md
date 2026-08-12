# Plan: Add arcanum configuration

Issue: [128-add-arcanum-configuration.md](../issues/128-add-arcanum-configuration.md)

## Overview

Generalize arcanum's per-repo configuration from `auto-fix-all`-specific files into a namespaced, arcanum-wide scheme (`arcanum-repo-config.json` / `arcanum-config.json`), with a fallback+warning for repos still on the legacy files, and introduce a versioned per-repo migration system (`arcanum/migrations/repos/<version>/NNN.sh`) plus a new `arcanum-migrate` skill so repos that already installed arcanum can catch up on structural changes as arcanum evolves. This issue's own config-rename ships as the very first migration (`001.sh`), self-bootstrapping the new system.

## Context

Today `.claude/configuration/auto-fix-all.json` and `.claude/state/auto-fix-all-config.json` are read/written directly by `auto-fix-all/scripts/config.sh` (the primary CLI) and independently by `auto-fix-all/scripts/wait_ci.sh` (which does its own direct `jq` read of `ignored_check_patterns`, bypassing `config.sh`). `init-claude/setup_ci_monitoring.md` and `init-claude/setup_auto_fix_all_config.md` write to these same legacy files when setting up a new repo. There is no mechanism today for an already-installed repo to be walked through repo-side structural changes — `arcanum-update` only updates the arcanum skill install itself, never files inside the consuming repo.

Full design detail (naming decisions, edge cases, the migration failure contract, locking, backward compatibility) lives in the issue file linked above — this plan sequences the implementation, it doesn't repeat every rationale.

## Implementation Steps

### Step 1 — Shared config-fallback helper (`arcanum/_lib/repo_config.sh`)

Add a new sourced-only library file, following the pattern of `arcanum/_lib/lock.sh`, exposing two functions used by anything that reads/writes namespaced per-repo config:

- `repo_config_read <new_file> <legacy_file> <namespace> <key>` — reads `<key>` from `<new_file>`'s `.<namespace>` object if present; otherwise falls back to reading `<key>` directly from `<legacy_file>` and prints a warning to stderr (pointing at `docs/guides/arcanum-repo-config.md`) that the config has moved.
- `repo_config_write <new_file> <legacy_file> <namespace> <key> <value>` — acquires the lock (via `arcanum/_lib/lock.sh`, lock file `<new_file>.lock`), and if `<new_file>` doesn't exist yet, first seeds it with the *entire* contents of `<legacy_file>` (if present) nested under `.<namespace>`, then applies `<key>`=`<value>` on top; releases the lock.

Both functions are file-path-agnostic so they work identically for the `.claude/configuration/` pair (`arcanum-repo-config.json` / `auto-fix-all.json`) and the `.claude/state/` pair (`arcanum-config.json` / `auto-fix-all-config.json`).

### Step 2 — Route `auto-fix-all` through the new helper

- `auto-fix-all/scripts/config.sh`: replace the hardcoded `CONFIG_FILE`/`STATE_CONFIG_FILE` direct-`jq` reads/writes in `get`/`is-enabled`/`set`/`toggle` with calls to `repo_config_read`/`repo_config_write`, pointing at `arcanum-repo-config.json`/`arcanum-config.json` as the new files and the existing two as legacy, namespace `auto-fix-all`. The CLI surface (`get`/`is-enabled`/`set`/`toggle <key>`) does not change.
- `auto-fix-all/scripts/wait_ci.sh`: replace its direct `jq -c '.ignored_check_patterns // []' "$CONFIG_FILE"` read with `repo_config_read ... auto-fix-all ignored_check_patterns` (adjusting for the fact this returns a JSON array, not a scalar — `repo_config_read` should just print the raw value, letting the caller `jq` it if needed, same contract `config.sh get` already has).

### Step 3 — Migration runner scripts (`arcanum/migrations/`)

Add, under `arcanum/migrations/`:

- `generate_next.sh` — computes the next `NNN.sh` filename under `arcanum/migrations/repos/next/`: `001` if none exist, else `(highest existing number) + 1`.
- `run.sh` — top-level entry point. Reads the repo's current version from `.claude/configuration/arcanum-repo-config.json` (`repo_config_read`-style lookup, but for the plain `.version` field, not a namespaced key). If absent, treats it as `0.0.0` and warns (pointing at `docs/guides/arcanum-repo-version.md`) that all migrations will run because no version was found. If present but not valid semver, hard-errors. Lists version folders under `arcanum/migrations/repos/` strictly greater than the current version; if none, reports "up to date" and exits. Otherwise shows the current version and prompts `[A]ll` / `[N]one` / `[S]elect`.
  - `[A]ll` — loops over pending versions calling `update_per_version.sh <version> --no-confirm`.
  - `[N]one` — exits without touching the recorded version.
  - `[S]elect` — delegates to `select_version.sh`.
- `select_version.sh` — lists pending versions plus `[D]one`; on a version pick (no validation that it's a real pending version), calls `update_per_version.sh <version>` (confirmation still required), then loops back to the list until `[D]one`.
- `update_per_version.sh <version> [--no-confirm]` — with `--no-confirm`, runs every file in `arcanum/migrations/repos/<version>/` in numeric order via `update_per_file.sh <version> <file> --no-confirm`. Without it, lists the files and prompts `[A]ll`/`[N]one`/`[S]elect`, mirroring `run.sh`'s top-level prompt one level down.
- `update_per_file.sh <version> <file> [--no-confirm]` — without `--no-confirm`, prints the paired `<file base>.md` content and prompts `[R]un`/`[S]kip`. To actually run: calls `<file> config` to get `{"skippable": true|false, ...}`, then `<file> run`. On success, advances the recorded version (locked write, same helper as Step 1 but for the plain `.version` field). On failure: if skippable, records the error to `.claude/state/arcanum-errors.json` (overwritten fresh per top-level `run.sh` invocation, not appended) and still advances the version past this file; if not skippable, records the error, halts the entire run immediately, and leaves the version at the last fully-clean point. At the very end of a `run.sh` invocation, print every collected error.

### Step 4 — `arcanum-migrate` skill

Add a new skill (single `SKILL.md`, following `arcanum-update`'s pattern of a plain interactive skill — not the two-layer coordinator/architect split, since this is user-triggered and not part of the `auto-*` autonomous family) that calls `arcanum/migrations/run.sh` and relays its output live.

### Step 5 — `bump-version.sh` — roll `next/` into a version folder

Extend `scripts/bump-version.sh` to also move `arcanum/migrations/repos/next/` → `arcanum/migrations/repos/<new-version>/`, then recreate `arcanum/migrations/repos/next/` with a `.keep` file inside.

### Step 6 — This issue's own migration (001)

Add `arcanum/migrations/repos/next/001.sh` (+ `001.md` explaining it) implementing the `config`/`run` contract from Step 3:
- `config` → `{"skippable": true}`.
- `run` → if `.claude/configuration/auto-fix-all.json` exists and `.claude/configuration/arcanum-repo-config.json` doesn't (or lacks the `auto-fix-all` key), copy its content under `.auto-fix-all` in the new file; same for the state-file pair. Idempotent — safe to re-run if already migrated (no-ops if the new file already has the namespaced key).

### Step 7 — `init-claude` updates

- `init-claude/setup_ci_monitoring.md`: change the write target from hand-crafted `.claude/configuration/auto-fix-all.json` JSON to writing `.claude/configuration/arcanum-repo-config.json`'s `.auto-fix-all.ignored_check_patterns` (via `repo_config_write`, or a small dedicated script call if writing an array is awkward through the scalar-`<value>` helper signature — flag this as an implementation detail for whichever agent picks it up).
- `init-claude/setup_auto_fix_all_config.md`: already routes through `config.sh set`, which now targets the new files automatically via Step 2 — no direct change needed here beyond re-reading the step to confirm nothing else hardcodes the legacy path.
- Add a step (or extend an existing one) so `init-claude` stamps `.version` in `.claude/configuration/arcanum-repo-config.json` with the arcanum version being configured — this is what `arcanum/migrations/run.sh` reads.

### Step 8 — Docs

- `docs/guides/arcanum-repo-config.md` — explains the config-file move and what to do about the fallback warning.
- `docs/guides/arcanum-repo-version.md` — explains how the repo's arcanum version is tracked, where it lives, and how to set it manually.
- `scripts/build_release_zip.sh` — add a carve-out to `EXCLUDES` so `docs/` stays excluded except `docs/guides/`.
- `docs/agents/architecture.md` — update the "Shared State & Configuration Files" table: rename the `auto-fix-all.json`/`auto-fix-all-config.json` rows to describe the new namespaced files + fallback behavior, and add a short "Per-Repo Migrations" section describing `arcanum/migrations/`, the `arcanum-migrate` skill, and the `NNN.sh config`/`run` contract (mirroring how "Lock System" is documented today).
- `docs/agents/folder-structure.md` — update the `.claude/configuration/` row's example filename.

## Files to Change

- `arcanum/_lib/repo_config.sh` — new shared fallback+lock-aware read/write helper.
- `auto-fix-all/scripts/config.sh` — route `get`/`is-enabled`/`set`/`toggle` through the new helper.
- `auto-fix-all/scripts/wait_ci.sh` — route its direct config read through the new helper.
- `arcanum/migrations/generate_next.sh` — new, `NNN.sh` filename generator.
- `arcanum/migrations/run.sh` — new, top-level migration entry point.
- `arcanum/migrations/select_version.sh` — new, per-version selection loop.
- `arcanum/migrations/update_per_version.sh` — new.
- `arcanum/migrations/update_per_file.sh` — new.
- `arcanum/migrations/repos/next/.keep` — new, initial empty pending-migrations folder.
- `arcanum/migrations/repos/next/001.sh`, `arcanum/migrations/repos/next/001.md` — new, this issue's own migration.
- `arcanum-migrate/SKILL.md` — new skill.
- `scripts/bump-version.sh` — extend to roll `arcanum/migrations/repos/next/` into `arcanum/migrations/repos/<version>/`.
- `init-claude/setup_ci_monitoring.md` — write target changes to the new namespaced file.
- `init-claude/setup_auto_fix_all_config.md` — re-verify, likely no change (routes through `config.sh`).
- `docs/guides/arcanum-repo-config.md`, `docs/guides/arcanum-repo-version.md` — new guides.
- `scripts/build_release_zip.sh` — `EXCLUDES` carve-out for `docs/guides/`.
- `docs/agents/architecture.md` — update config table + add migrations section.
- `docs/agents/folder-structure.md` — update config filename reference.
- `docs/agents/issue-enhancement.md` — already committed on this branch (the "Migration needed?" checklist item), no further change.

## Notes

- No CI job runs against PR branches in this repo (`.circleci/config.yml`'s only job is filtered to tag pushes only), so there's no `## CI Checks` section to add — verification here is manual (run the new scripts directly against a scratch `.claude/` tree).
- Step 1–3 and Step 5–6 are deterministic script work — dispatch to the `scripter` agent (per `docs/agents/architecture.md`'s Agent Roster) rather than writing complex bash inline. Step 4 (new skill markdown), Step 7 (init-claude step edits), and Step 8 (docs) are architect-scope work (writing/editing skill `.md` files and project docs).
- `update_per_file.sh`'s "advance the version" write and `repo_config_write` both mutate `arcanum-repo-config.json` — make sure both go through the *same* lock file path so they can't race each other.
- The exact array-value plumbing for `init-claude/setup_ci_monitoring.md` writing `ignored_check_patterns` (a JSON array, not a scalar) through `repo_config_write` needs a small design check during implementation — `repo_config_write`'s `<value>` parameter may need to accept pre-formed JSON rather than assuming a scalar string.
