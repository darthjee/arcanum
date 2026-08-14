# Plan: Add local vs. repo scope tracking to per-repo migrations

Issue: [149-add-local-vs--repo-scope-tracking-to-per-repo-migrations.md](../../issues/149-add-local-vs--repo-scope-tracking-to-per-repo-migrations.md)

## Overview

Introduce a `migrations.json` manifest per version folder under `arcanum/migrations/repos/`, replacing implicit glob ordering, with per-entry `applies_to: "repo"|"local"` scope. Add a second, local-only version pointer (`.claude/state/arcanum-config.json`'s `.migrations.version`), and make the runner chain (`run.sh` → `select_version.sh`/`update_per_version.sh` → `update_per_file.sh`) walk a single loop over the union of committed- and local-pending versions, gating each manifest entry by whichever pointer its scope answers to. Fix the pre-existing bug where `.version` advances per-file instead of per-completed-manifest. `0.9.3` stays fully legacy (glob-discovered); `0.12.0/001.sh` is retrofitted to the new manifest format as a one-time exception, since its `next/001.sh` predecessor already shipped before this issue could apply the "not retrofitted" rule to it. `generate_next.sh`, `scripts/bump-version.sh`, and `init-claude`'s `stamp_arcanum_version.sh` are updated to match, and the two directly-affected guides are updated to document the new schema and pointer.

This repo has no dedicated agent whose scope literally covers `arcanum/_lib/`, `arcanum/migrations/`, or root-level `scripts/` (see `.claude/agents/scripter.md` — its scope is narrowly `<skill-name>/scripts/`); those, plus `docs/guides/`, fall to the architect as this repo's catch-all for root-level/shared-infra work and documentation. Only `init-claude/scripts/stamp_arcanum_version.sh` sits inside a skill's own `scripts/` folder — noted inline below for whoever picks up that step. No agent split: the work isn't cleanly separable into independent chunks (every file shares the same `migrations.json` schema and pointer semantics), and `skill-reviewer` has no applicable work (this issue touches no `SKILL.md`/step files).

## Context

`.claude/configuration/` is committed; `.claude/state/` is gitignored (confirmed: `.gitignore:1: .claude/state/`) and local per clone. Today, `update_per_file.sh` advances the single committed `.version` on every successful migration file — including ones whose only effect is a `.claude/state/` write — so a second clone that pulls the commit sees `.version` already at the target and wrongly believes it's caught up, even though its own `.claude/state/` was never touched. Separately, `repo_config_set_version` firing per-file (not once per completed version) means a version that partially succeeds (e.g. `001.sh` OK, `002.sh` halts) is wrongly treated as no-longer-pending on retry.

Confirmed while exploring the runner chain (`arcanum/migrations/run.sh` → `update_per_version.sh` → `update_per_file.sh` → `_pending_versions.sh`/`select_version.sh`, and `arcanum/_lib/repo_config.sh`):
- `_pending_versions.sh` takes only the committed version and explicitly excludes `next`; both `run.sh` and `select_version.sh` share it.
- `update_per_file.sh` calls `<file> config` for `{"skippable": ...}` before `<file> run`, and calls `repo_config_set_version` immediately on success — the exact per-file bug this issue fixes.
- `arcanum/migrations/repos/next/` currently holds only `.keep` — `next/001.sh` (the `plan-issues` retry/backoff migration) shipped as `repos/0.12.0/001.sh` in the prior version bump (commit `388c481`, the day before this issue was refined), confirmed via `git log --diff-filter=R -- 'arcanum/migrations/repos/*'`.
- `scripts/bump-version.sh` rolls `repos/next/` into `repos/<new-version>/` and recreates `next/` with a `.keep` placeholder on every bump; it needs to switch to an always-present `migrations.json` instead.
- `generate_next.sh` globs `repos/next/[0-9][0-9][0-9].sh` for the next id; it needs to read `migrations.json` instead.
- `init-claude/scripts/stamp_arcanum_version.sh` only stamps the committed `.version` today.

## Implementation Steps

### Step 1 — Define the `migrations.json` schema and write it for `next/` and `0.12.0/`

- `arcanum/migrations/repos/next/migrations.json`: `[]` (nothing pending yet), replacing `next/.keep`.
- `arcanum/migrations/repos/0.12.0/migrations.json`: one entry for the existing `001.sh` — `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "local"}` (matches `001.sh`'s current `config` output and its `.claude/state/arcanum-config.json`-only writes). `0.12.0/001.sh` itself needs no code change — only its `config` subcommand becomes unused by the new-format path (kept as-is; harmless, and still load-bearing for anyone who hasn't upgraded the runner yet).
- `arcanum/migrations/repos/0.9.3/` gets no `migrations.json` — it stays glob-discovered.
- Document the schema shape (fields, allowed values, the "no `both`" rule) as a comment block at the top of `_pending_versions.sh` or a new small `arcanum/migrations/MANIFEST.md`/doc-comment — whichever fits this repo's existing convention for documenting shared script contracts (check how `update_per_file.sh`'s header comment documents the `NNN.sh` contract today and mirror that style).

### Step 2 — Add the local version pointer helpers

`arcanum/_lib/repo_config.sh` already has `repo_config_get_version`/`repo_config_set_version`, but they're hardcoded to reading/writing a top-level `.version` field on whatever file is passed in. Add equivalents (or generalize the existing ones with a `--key`-style parameter, whichever keeps the diff smaller) for a *namespaced* version field, since the local pointer lives at `.migrations.version` inside `.claude/state/arcanum-config.json`, not at the file's top level like the committed `.version`. Keep the lock-protected, atomic-write pattern the existing functions already use.

### Step 3 — Make the manifest + scope + dual-pointer logic the runner's discovery path

This is the core of the issue, spread across the existing runner chain:

- **`_pending_versions.sh`**: grow to accept both the committed and local current versions, and compute the union described in the issue's Solution ("Single loop, not two") — every version folder whose manifest has at least one `repo`-scoped entry beyond the committed pointer, or one `local`-scoped entry beyond the local pointer. Still excludes nothing by name (drop the `next` exclusion once `next/` always has a `migrations.json`, since an empty `[]` naturally contributes nothing pending) — confirm this doesn't change behavior for `0.9.3`/legacy-only setups.
- **Manifest vs. glob discovery**: add a small helper (e.g. in `_pending_versions.sh` or a new lib file) that, given a version dir, returns its ordered entry list — reading `migrations.json` if present, else falling back to legacy `find *.sh | sort` with implicit `applies_to: "repo"`, `skippable` sourced from `<file>.sh config` (today's behavior, unchanged for `0.9.3`).
- **`update_per_version.sh`**: switch from listing `*.sh` files to listing manifest entries (via the helper above); for the confirmation UI, show/skip entries per the "already-satisfied entries are silently skipped" rule from the issue (an entry is satisfied if its scope's pointer already covers this version).
- **`update_per_file.sh`**: for manifest-driven entries, skip the `<file>.sh config` call (skippable comes from the manifest) and stop calling `repo_config_set_version` on every success. Instead, version-advance moves to end-of-manifest (see Step 4). For `type: "script"` entries this still shells out to `<file>.sh run`; `config` is only still called for legacy (glob-discovered) entries.
- **`select_version.sh`**: update its pending-list computation to match `_pending_versions.sh`'s new dual-pointer signature.
- **`run.sh`**: thread the local version through the same way it already threads the committed one (`_resolve_current_version`-equivalent for the local pointer, reading `.claude/state/arcanum-config.json`).

### Step 4 — Fix the version-advance bug (per-manifest, not per-file)

Move the version-advance call out of `update_per_file.sh`'s per-file success path and into whichever level owns "this version's manifest is now fully processed" (likely `update_per_version.sh`, after its loop over entries completes without a halt). At that point: advance the committed pointer if every `repo`-scoped entry in the manifest is now satisfied, and the local pointer if every `local`-scoped entry is. Apply this uniformly — legacy (glob-discovered, all-`repo`) versions go through the same completion check, so `0.9.3` also stops advancing on partial success.

### Step 5 — `generate_next.sh` becomes manifest-aware

Read `migrations.json` and take `(highest existing "id" across all entries) + 1` instead of globbing `*.sh`. Keep the same zero-padded `NNN` output format.

### Step 6 — `scripts/bump-version.sh`: retire `.keep` in favor of `migrations.json`

- `is_migrations_dir_empty` needs to check `migrations.json == []` instead of "no files other than `.keep`".
- The empty-`next/`-recreation step writes `migrations.json` containing `[]` instead of touching `.keep`.
- The roll-forward (`next/` → `repos/<new-version>/`) step carries whatever `migrations.json` `next/` already has, unchanged.

### Step 7 — `init-claude/scripts/stamp_arcanum_version.sh` stamps both pointers

*(This file lives under a skill's own `scripts/` folder — `init-claude`'s — matching `scripter`'s documented scope; call this out explicitly if this plan is picked up by dispatch logic that routes by file path.)*

Add a second `repo_config_set_version`-equivalent call (using Step 2's namespaced-key helper) writing the same resolved version into `.claude/state/arcanum-config.json`'s `.migrations.version`, right alongside the existing committed-`.version` write. Same "silent no-op if version can't be resolved" behavior as today.

### Step 8 — Documentation

Update `docs/guides/arcanum-repo-version.md` and `docs/guides/arcanum-repo-config.md` to document: the `migrations.json` schema (`id`/`type`/`file`/`skippable`/`applies_to`), the second local pointer (`.claude/state/arcanum-config.json`'s `.migrations.version`) alongside the existing committed `.version`, and — briefly — the single-loop dual-gating behavior this enables. Also update `docs/agents/architecture.md`'s existing "Per-Repo Migrations" section (the "Layout"/"contract"/"runner chain" paragraphs already describing `arcanum/migrations/`) to reflect manifest discovery, scope, and the per-manifest (not per-file) version advance — this doc is the narrative source the two guides above summarize for end users, and it's already out of date the moment this ships if left untouched.

## Files to Change

- `arcanum/migrations/repos/next/migrations.json` — new, `[]`, replaces `next/.keep`.
- `arcanum/migrations/repos/0.12.0/migrations.json` — new, one `local`-scoped entry for `001.sh` (the retrofit exception).
- `arcanum/migrations/_pending_versions.sh` — dual-pointer union computation; manifest-vs-glob discovery helper.
- `arcanum/migrations/update_per_version.sh` — manifest-driven entry listing; skip-if-already-satisfied display logic.
- `arcanum/migrations/update_per_file.sh` — stop calling `<file> config` for manifest entries; stop per-file version-advance.
- `arcanum/migrations/select_version.sh` — updated pending-list call signature.
- `arcanum/migrations/run.sh` — resolve and thread the local pointer alongside the committed one; per-manifest version-advance call site (or delegate to `update_per_version.sh`, per Step 4).
- `arcanum/migrations/generate_next.sh` — read `migrations.json` instead of globbing `*.sh`.
- `arcanum/_lib/repo_config.sh` — namespaced version get/set helpers for the local pointer.
- `scripts/bump-version.sh` — `migrations.json`-based empty-check and roll-forward instead of `.keep`.
- `init-claude/scripts/stamp_arcanum_version.sh` — stamp the local pointer too. *(scripter's scope.)*
- `docs/guides/arcanum-repo-version.md` — document the local pointer.
- `docs/guides/arcanum-repo-config.md` — document the `migrations.json` schema and scope.
- `docs/agents/architecture.md` — update the existing "Per-Repo Migrations" section for manifest discovery, scope, and per-manifest version-advance.

## Notes

- **Accepted trade-off (per issue discussion):** repos already on committed version ≥ `0.12.0` have no local pointer yet after this ships (reads as absent → `0.0.0`), so they'll see `0.12.0`'s now-local entry as pending and re-run it, and `repo_config_write` unconditionally overwrites `plan-issues.max-retry-count`/`error-sleep-time` back to defaults (`5`/`5`) rather than only-if-absent. Accepted as one-time, low-risk (same default values, only clobbers a value if a user customized this obscure config since upgrading). No code change needed for this — just confirm the behavior matches this expectation when testing the retrofit.
- `0.9.3/001.sh` keeps its existing (pre-existing, out-of-scope-to-fix) local-write-gated-by-committed-version behavior — legacy discovery path is otherwise untouched.
- No automated test suite exists in this repo (checked — no `test`/`spec` directories); verification is manual/read-through, consistent with how prior migration-runner fixes (e.g. issue #131/#128) were validated.
- Sub-issue #150 (AI-instruction migrations) depends on this issue's `migrations.json` schema (`type` field, entry shape) staying stable — avoid renaming/restructuring fields casually during implementation without checking #150 isn't already mid-flight.
