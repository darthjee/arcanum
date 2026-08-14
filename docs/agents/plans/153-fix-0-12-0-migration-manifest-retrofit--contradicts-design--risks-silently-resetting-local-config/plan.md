# Plan: Fix 0.12.0 migration-manifest retrofit: contradicts design, risks silently resetting local config

Issue: [153-fix-0-12-0-migration-manifest-retrofit--contradicts-design--risks-silently-resetting-local-config.md](../../issues/153-fix-0-12-0-migration-manifest-retrofit--contradicts-design--risks-silently-resetting-local-config.md)

## Overview

`0.12.0` was retrofitted with a `migrations.json` manifest (`applies_to: "local"`) after it had already shipped as a fully-legacy, glob-discovered, `repo`-scoped folder — before the manifest format existed at all. This contradicts the original #149/#150 design, contradicts one paragraph of `docs/agents/architecture.md`'s "Per-Repo Migrations" section, and creates a real risk: any repo that already updated arcanum and ran migrations during the ~1-day gap between `0.12.0`'s release and the manifest retrofit landing has no local pointer, so `/arcanum-migrate` will flag `0.12.0` pending again and silently reset their `plan-issues.max-retry-count`/`error-sleep-time` back to defaults. This plan reverts `0.12.0` to fully legacy status, reconciles every doc/comment that describes it, and removes a small piece of related dead code.

## Context

Confirmed by direct inspection (see issue #153 for full detail):
- `arcanum/migrations/repos/0.12.0/migrations.json` exists on disk with `{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "local"}`.
- `0.12.0` was tagged/released (commit `388c481`, published 2026-08-13T18:42Z) as a fully-legacy folder — no manifest — a full day before the manifest retrofit landed in `0051afa`/`634f519` (2026-08-14).
- `docs/agents/architecture.md` line 209 says every version folder from `0.12.0` onward always has a manifest; line 233 says legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped and never touch the ledger. These directly contradict each other.
- `arcanum/migrations/_manifest.sh`'s header comment (line 3) makes the same "from 0.12.0 onward" claim as architecture.md line 209.
- `arcanum/migrations/update_per_version.sh`'s `ENTRY_SCOPE` array (line 129 declaration, line 152 append) is populated but never read anywhere afterward.
- `arcanum/migrations/repos/0.9.3/` (the genuine legacy folder) has no `migrations.json`, and its `001.sh` writes via `repo_config_seed` (idempotent seed-if-absent) rather than `repo_config_write` — the layout and pattern `0.12.0` should match once reverted.

## Implementation Steps

### Step 1 — Revert `0.12.0` to fully legacy status

Delete `arcanum/migrations/repos/0.12.0/migrations.json`. Leave `.keep`, `001.md`, and `001.sh` in place unchanged — this exactly matches `0.9.3`'s current layout (`.keep` + `001.md` + `001.sh`, no manifest), so `arcanum/migrations/_manifest.sh`'s existing glob-discovery fallback picks it up automatically as an implicit `applies_to: "repo"`, `type: "script"` entry with `skippable` sourced live from `001.sh config`. No code change is needed for the discovery mechanism itself — `_manifest_entries` already implements this fallback; removing the manifest file is what activates it for `0.12.0`.

Do not modify `arcanum/migrations/repos/0.12.0/001.sh`. Its `repo_config_write` (unconditional overwrite, as opposed to `0.9.3/001.sh`'s `repo_config_seed`) stops being a regression risk once `0.12.0` is `repo`-scoped again: a `repo`-scoped entry is satisfied once the *committed* `.version` pointer reaches `0.12.0`, and that pointer travels with the repo through git — so it can never silently re-trigger on a second clone or a later run the way the `local`-scoped variant did. Changing `001.sh`'s write mechanism is out of scope for this issue (not required by any acceptance criterion) and would only add risk to an already-shipped script.

### Step 2 — Fix `docs/agents/architecture.md`'s contradiction

In the "Per-Repo Migrations" section, line 209 currently ends: *"`0.9.3` is the one version folder that stays fully legacy — no `migrations.json`, discovered by globbing `NNN.sh` instead (see "Manifest vs. legacy discovery" below); every version folder from `0.12.0` onward always has one."*

Change this to describe **both** `0.9.3` and `0.12.0` as the legacy exceptions, and manifests as starting from the version after `0.12.0` — e.g.: *"`0.9.3` and `0.12.0` are the two version folders that stay fully legacy — no `migrations.json`, discovered by globbing `NNN.sh` instead (see "Manifest vs. legacy discovery" below); every version folder after `0.12.0` always has one."*

Line 233 (the `AI_INSTRUCTIONS` hand-off/ledger paragraph) already says *"legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped `script` entries and never touch the ledger"* — this is already correct once Step 1 lands; leave it unchanged.

### Step 3 — Fix the matching comment in `arcanum/migrations/_manifest.sh`

Line 3's header comment says *"...its migrations.json manifest (preferred, every version folder from 0.12.0 onward)..."*. Update it to match Step 2's phrasing — manifests preferred from the version after `0.12.0` onward, with `0.9.3` and `0.12.0` both named in the "legacy glob discovery" fallback description on the following lines (which currently only names `0.9.3` and "any future not-yet-retrofitted folder" — add `0.12.0` there explicitly, since it's no longer just a hypothetical future case).

### Step 4 — Remove dead `ENTRY_SCOPE` code in `update_per_version.sh`

In `arcanum/migrations/update_per_version.sh`, `ENTRY_SCOPE` is declared alongside the other per-entry arrays (`ENTRY_ID`, `ENTRY_TYPE`, `ENTRY_FILE`, `ENTRY_INSTRUCTIONS_FILE`, `ENTRY_SKIPPABLE`) at line 129 and appended to at line 152 (`ENTRY_SCOPE+=("$applies_to")`), but never read anywhere afterward in the file. Remove both the declaration and the append — do not introduce a new use for it, since nothing in the current design needs a *stored* scope array (each entry's `applies_to` is already consumed inline, per-entry, inside the same loop that builds these arrays, via the `satisfied` check that happens before anything is appended).

## Files to Change

- `arcanum/migrations/repos/0.12.0/migrations.json` — delete.
- `docs/agents/architecture.md` — line 209: reword to name both `0.9.3` and `0.12.0` as the legacy exceptions and shift the "always has a manifest" claim to start after `0.12.0`. Line 233: no change (already correct).
- `arcanum/migrations/_manifest.sh` — header comment (around line 3): same "0.9.3 and 0.12.0 are legacy, manifests start after 0.12.0" correction.
- `arcanum/migrations/update_per_version.sh` — remove the unused `ENTRY_SCOPE` array declaration (line 129) and append (line 152).

## Notes

- No test suite or CI job covers `arcanum/migrations/` (CircleCI here only builds/releases the zip on tag push) — verify manually: after Step 1, run `arcanum/migrations/run.sh --repo <scratch-clone> check` (or the equivalent through `_pending_versions.sh`/`update_per_version.sh`) against a scratch repo whose committed `.version` is `0.12.0` or later and whose local `.migrations.version` is absent, and confirm `0.12.0` no longer shows as pending.
- `README.md`'s "Current Version: 0.12.0" and `arcanum/install/bootstrap.sh`'s `DEFAULT_VERSION="0.12.0"` are unrelated to the manifest/discovery mechanism and are out of scope — do not touch them.
- `arcanum/migrations/repos/0.12.0/001.md` stays as-is; it's unused by legacy glob-discovery (same as `0.9.3/001.md`) but kept purely as human-readable documentation, matching existing convention.
