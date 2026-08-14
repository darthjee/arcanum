# Fix `0.12.0` migration-manifest retrofit: contradicts design, risks silently resetting local config

## Context

While validating the merged implementation of #149 (Fix in #151) and #150 (Fix in #152) — the dual-pointer per-repo migration scope tracking and AI-instruction migrations — I found a deviation from the agreed design that carries a concrete regression risk for consuming repos.

Both sub-issues explicitly said legacy version folders `0.9.3` and `0.12.0` should stay glob-discovered, wholesale implicit `repo` scope, not retrofitted to the new `migrations.json` manifest format — specifically to avoid rewriting migration history that had already been applied by repos in the wild. `docs/agents/architecture.md`'s "Per-Repo Migrations" section still says this in one place (the `AI_INSTRUCTIONS` hand-off/ledger paragraph: *"legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped `script` entries and never touch the ledger"*), but it directly contradicts what an earlier paragraph in the **same file** says (*"`0.9.3` is the one version folder that stays fully legacy... every version folder from `0.12.0` onward always has [a `migrations.json`]"*) — and what's actually on disk:

```json
// arcanum/migrations/repos/0.12.0/migrations.json
[
  {"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "local"}
]
```

`0.12.0` was retrofitted with a manifest declaring its `001.sh` as `applies_to: "local"` — not left as legacy `repo`-scoped, and not left alone at all.

**Likely root cause**: by the time #149 was implemented, `arcanum/migrations/repos/next/001.sh` (the migration referenced by the original design discussion) had already been promoted to `0.12.0/001.sh` by an earlier "Bump version" commit (`388c481`, using the pre-manifest `bump-version.sh`). So "convert `next/001.sh` freely, since `next` was never applied anywhere" no longer matched reality by the time implementation started, and the implementation adapted by retrofitting `0.12.0` instead — without reconciling the rest of the design/docs to match, or considering the consequence below.

## The regression risk

`0.12.0/001.sh` writes via `repo_config_write`, which **unconditionally overwrites** (not seed-if-absent):

```bash
repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count" 5
repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "error-sleep-time" 5
```

Any repo that already had its committed `.version` at `0.12.0` or later **before** this feature shipped (i.e. already ran this migration under the old, single-pointer system) has no local pointer yet (`.claude/state/arcanum-config.json`'s `.migrations.version` is absent, defaulting to `0.0.0`, per `docs/guides/arcanum-repo-version.md`'s documented missing-pointer fallback). The next time such a repo runs `/arcanum-migrate`, `0.12.0` will be flagged pending again on the local axis (`_pending_versions` sees `0.12.0 > 0.0.0`), and `001.sh` will silently re-run, resetting `plan-issues.max-retry-count`/`error-sleep-time` back to the defaults (`5`/`5`) for anyone who had customized them.

## What needs to be done

- Reconcile whether `0.12.0` should genuinely be manifest-driven (`applies_to: "local"`, as it is now) or reverted to fully legacy glob-discovery, consistent with the rest of the design. If `0.12.0` was never actually released/consumed by any external repo before this feature shipped, keeping the retrofit may be safe — but that needs to be confirmed, not assumed.
- If the retrofit stays: make `0.12.0/001.sh`'s effect idempotent/seed-only (e.g. switch to a seed-if-absent write, or otherwise guard against clobbering an already-customized value) so re-running it for an already-caught-up repo is harmless.
- Fix the contradiction in `docs/agents/architecture.md`'s "Per-Repo Migrations" section — one paragraph says `0.12.0` stays legacy/`repo`-scoped, another (correctly, matching what's on disk) says it's manifest-driven from `0.12.0` onward. Only one can be true; update whichever is wrong.
- Minor cleanup found during the same review, worth folding in here:
  - `update_per_version.sh`'s `ENTRY_SCOPE` array is populated (`ENTRY_SCOPE+=("$applies_to")`) but never read afterward — dead code.
  - `arcanum/migrations/repos/0.12.0/.keep` is still present alongside the new `migrations.json`; the design (and `docs/agents/architecture.md`) says `.keep` goes away once a `migrations.json` is always present — `0.12.0`'s leftover `.keep` should be removed.

## Acceptance criteria

- [ ] `0.12.0`'s manifest-vs-legacy status is a deliberate, documented decision (not an unreconciled artifact of the `next`→`0.12.0` promotion timing).
- [ ] Re-running `0.12.0`'s migration (whichever form it ends up in) cannot silently overwrite a repo's already-customized `plan-issues.max-retry-count`/`error-sleep-time`.
- [ ] `docs/agents/architecture.md`'s "Per-Repo Migrations" section is internally consistent about `0.12.0`'s discovery mechanism.
- [ ] `ENTRY_SCOPE` dead code removed from `update_per_version.sh`, or put to actual use.
- [ ] `arcanum/migrations/repos/0.12.0/.keep` removed.
