# Issue: Fix 0.12.0 migration-manifest retrofit: contradicts design, risks silently resetting local config

## Description

While validating the merged implementation of #149 (Fix in #151) and #150 (Fix in #152) — the dual-pointer per-repo migration scope tracking and AI-instruction migrations — a deviation from the agreed design was found that carries a concrete, already-live regression risk for consuming repos.

Both sub-issues explicitly said legacy version folders `0.9.3` and `0.12.0` should stay glob-discovered, wholesale implicit `repo` scope, not retrofitted to the new `migrations.json` manifest format — specifically to avoid rewriting migration history that had already been applied by repos in the wild. `docs/agents/architecture.md`'s "Per-Repo Migrations" section still says this in one place (the `AI_INSTRUCTIONS` hand-off/ledger paragraph: *"legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped `script` entries and never touch the ledger"*), but it directly contradicts what an earlier paragraph in the **same file** says (*"`0.9.3` is the one version folder that stays fully legacy... every version folder from `0.12.0` onward always has [a `migrations.json`]"*) — and what's actually on disk:

```json
// arcanum/migrations/repos/0.12.0/migrations.json
[
  {"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "local"}
]
```

`0.12.0` was retrofitted with a manifest declaring its `001.sh` as `applies_to: "local"` — not left as legacy `repo`-scoped, and not left alone at all.

**Root cause, confirmed**: `0.12.0` was tagged and released (`388c481`, "Bump version (#143)", published 2026-08-13T18:42Z) as a fully-legacy folder — no `migrations.json`, `next/001.sh` promoted in place by the pre-manifest `bump-version.sh` — a full day *before* #149/#150 landed (`0051afa`/`634f519`, both 2026-08-14). So by the time #149/#150 were implemented, `0.12.0` had already shipped in its legacy form; "convert `next/001.sh` freely, since `next` was never applied anywhere" no longer matched reality, and the implementation adapted by retrofitting `0.12.0` with `applies_to: "local"` instead — without reconciling the rest of the design/docs to match, or considering the consequence below.

## Problem

`0.12.0/001.sh` writes via `repo_config_write`, which **unconditionally overwrites** (not seed-if-absent):

```bash
repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count" 5
repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "error-sleep-time" 5
```

Any repo that already updated arcanum and ran migrations while its committed `.version` reached `0.12.0` — which, since `0.12.0` released a day before the manifest retrofit, means **any repo that updated at all in that window ran `001.sh` under the old, legacy, single-pointer system** — has no local pointer (`.claude/state/arcanum-config.json`'s `.migrations.version` is absent, defaulting to `0.0.0`, per `docs/guides/arcanum-repo-version.md`'s documented missing-pointer fallback). The next time such a repo runs `/arcanum-migrate`, `0.12.0` will be flagged pending again on the local axis (`_pending_versions` sees `0.12.0 > 0.0.0`), and `001.sh` will silently re-run, resetting `plan-issues.max-retry-count`/`error-sleep-time` back to the defaults (`5`/`5`) for anyone who had customized them. This is not a hypothetical edge case — it is the guaranteed outcome for every repo that updated during that ~1-day window.

Separately, and independent of the scope question: `0.9.3/001.sh` (the genuine legacy sibling) writes via `repo_config_seed`, which is idempotent seed-if-absent. `0.12.0/001.sh`'s use of `repo_config_write` (unconditional overwrite) is already inconsistent with how the established legacy-migration pattern writes config.

## Solution

- **Revert `0.12.0` to fully legacy status**: remove `arcanum/migrations/repos/0.12.0/migrations.json`, restoring glob-discovery and implicit wholesale `repo` scope, consistent with the original #149/#150 design. This is not an open question to defer — `0.12.0` is confirmed released and already consumed by any repo that updated during the ~1-day window before the manifest retrofit landed (see Description), so keeping the retrofit is confirmed unsafe, not merely unconfirmed-safe as originally suspected. Reverting also makes the regression resolve itself: already-updated consumers' committed `.version` is already `>= 0.12.0`, so the `repo`-scoped entry reads as already-satisfied — no re-run, no clobbering, no idempotency patch required on `0.12.0/001.sh` itself.
- Fix the contradiction in `docs/agents/architecture.md`'s "Per-Repo Migrations" section now that the decision is settled: the paragraph claiming *"every version folder from `0.12.0` onward always has [a `migrations.json`]"* is the one that needs updating (to say manifests start from the version after `0.12.0`); the ledger paragraph's *"legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped"* is already correct and needs no change.
- Minor cleanup found during the same review, worth folding in here:
  - `update_per_version.sh`'s `ENTRY_SCOPE` array is populated (`ENTRY_SCOPE+=("$applies_to")`) but never read afterward — dead code, confirmed by inspection (only the declaration and the append exist, no read site).
  - `arcanum/migrations/repos/0.12.0/.keep` is still present; once `migrations.json` is removed by the revert above, `.keep` is correct to keep for a legacy folder (matching `0.9.3`'s layout) — no separate removal needed once the revert lands.

## Acceptance criteria

- [ ] `arcanum/migrations/repos/0.12.0/migrations.json` is removed; `0.12.0` is glob-discovered and `repo`-scoped like `0.9.3`.
- [ ] A repo whose committed `.version` is already `>= 0.12.0` (simulating an already-updated consumer) does not have `0.12.0` flagged pending again, and `plan-issues.max-retry-count`/`error-sleep-time` are not silently reset.
- [ ] `docs/agents/architecture.md`'s "Per-Repo Migrations" section is internally consistent: manifests are described as starting from the version after `0.12.0`, and `0.12.0` is grouped with `0.9.3` as legacy.
- [ ] `ENTRY_SCOPE` dead code removed from `update_per_version.sh`, or put to actual use.
