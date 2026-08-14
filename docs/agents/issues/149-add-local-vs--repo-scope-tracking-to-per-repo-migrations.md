# Issue: Add local vs. repo scope tracking to per-repo migrations

## Description

Foundational half of #147 — split out (as sub-issue #149, with #150 covering the AI-instructions half) because it's logically independent of AI-triggered migrations (local-scoped *script* migrations already exist today) and defines the `migrations.json` schema that #150 builds on top of, so that schema doesn't need a breaking change later.

## Problem

`.claude/configuration/` is committed (shared via git across every clone of a repo); `.claude/state/` is gitignored — local to each clone/machine. That's a real problem for migrations whose effects live in `.claude/state/`: if Clone A runs such a migration and pushes, Clone B pulls and sees the committed `.version` already advanced (since the version bump and any repo-scoped effects travel together in the same commit). Under today's single version pointer, Clone B would wrongly conclude it's fully caught up, even though its own local state was never touched — `.claude/state/` never travels through git at all.

Separately, tracing `update_per_file.sh` surfaced a related, pre-existing bug: `repo_config_set_version` is called **per file**, right when an individual migration file succeeds — not once per fully-completed version. So if `001.sh` succeeds and `002.sh` later halts (non-skippable), `.version` is already advanced past that version after `001`'s success alone. On a later retry, `_pending_versions` (which filters `version > current`) would no longer treat that version as pending, even though it only partially ran.

## Solution

### `migrations.json` manifest per version

Each version folder gains a `migrations.json` manifest — the single source of run order and per-entry metadata, replacing today's implicit ordering-by-glob (`find *.sh | sort`):

```json
[
  {"id": "001", "type": "script", "file": "001.sh", "skippable": false, "applies_to": "repo"},
  {"id": "002", "type": "script", "file": "002.sh", "skippable": true, "applies_to": "local"}
]
```

- `type` only has the value `"script"` for now (sub-issue #150 adds `"instructions"` on top of this same schema).
- `skippable` moves into the manifest for every entry — `update_per_file.sh` stops shelling out to `<file>.sh config` to learn it. This is a contract change for new-manifest-driven `.sh` migrations (their `config` subcommand becomes redundant); `0.9.3` (the one version staying fully legacy, see below) is unaffected and keeps implementing `config`.
- `applies_to: "repo" | "local"` — no combined `"both"` value. A change needing both kinds of effects is authored as two separate entries. Reason: a `repo`-scoped entry's completion is answered by the committed version alone (one clone running it satisfies every clone via git); a `local`-scoped entry's completion is answered by the local version alone (each clone must independently apply it). A single `"both"` entry would need both answers at once, and they can genuinely diverge per clone (Clone A ran it — both sides advance for Clone A, but Clone B only inherits the committed side via git, never the local side). Splitting into two entries keeps each entry's "done?" question answerable by exactly one authority, with no cross-clone ambiguity.

### Second, local-only version pointer

A local version pointer lives in `.claude/state/arcanum-config.json` (namespaced, e.g. `.migrations.version`, via the existing `repo_config_write`/`repo_config_read` helpers in `arcanum/_lib/repo_config.sh`), independent of `.claude/configuration/arcanum-repo-config.json`'s committed `.version`.

`repo`-scoped entries don't need per-entry tracking for cross-clone purposes — since the committed version only advances once a version's entire repo-scoped portion is done, and that advance ships in the same commit as the effects themselves, any clone seeing committed `.version` ≥ `V` already has all of `V`'s repo-scoped effects; there's no partial state to reconcile, same all-or-nothing-per-version behavior as today. Only `local`-scoped entries need per-clone gating, since the local version pointer can lag the committed one by an arbitrary amount per clone.

### Single loop, not two

Candidate versions to process = union of (committed-version-pending versions) and (local-version-pending versions, i.e. versions with `local`-scoped entries beyond this clone's local pointer). For each candidate version, ascending, walk its manifest in `id` order — one confirmation flow, matching today's UX — and per entry: a `repo`-scoped entry only executes if committed version < this version; a `local`-scoped entry only executes if *this clone's* local version < this version. Already-satisfied entries are silently skipped, not even shown, same as a fully-passed version isn't shown today. At the end of a version, advance the committed pointer if all its `repo` entries are now satisfied, and the local pointer if all its `local` entries are.

Two separate loops (one full pass for `repo`, one full pass for `local`) was considered — easier to reason about in isolation, but worse for the user (two separate `[A]ll/[N]one/[S]elect/[C]hat` flows instead of one) and risks breaking authored ordering within a version where a `local` entry might rely on an earlier `repo` entry's effects, or vice versa, since the two scopes would no longer execute in their declared relative order. Rejected in favor of the single loop.

`_pending_versions.sh` (shared by `run.sh` and `select_version.sh`) currently takes only the committed version and excludes `next` outright; it needs to grow to consider both pointers.

### Fix the version-advance bug

`.version` (and the new local pointer) should only advance once the **entire manifest** for a version completes (its last relevant entry succeeds) — not per-file as `update_per_file.sh` does today. Mid-version progress lives in per-entry state, not in the coarse version field. This fix applies uniformly across the shared runner code path, so legacy versions benefit from the correctness fix too, without any other change to how they behave.

### `0.9.3` stays legacy; `0.12.0` is retrofitted as a one-time exception

`repos/next/` is currently empty (only `.keep`) — `next/001.sh` (the `plan-issues` retry/backoff migration, previously the intended conversion example) already shipped as `repos/0.12.0/001.sh` in the most recent version bump (the day before this issue was refined), so there's no file left in `next/` to convert.

`0.9.3` keeps legacy glob-discovery (`find *.sh`), wholesale implicit `repo` scope, gated purely by the committed version pointer — unchanged from today, including `0.9.3/001.sh`'s existing write to `.claude/state/arcanum-config.json` (a pre-existing local-write-gated-by-committed-version case, left as an accepted trade-off rather than retroactively fixed).

`0.12.0/001.sh`, by contrast, is retrofitted to the new `migrations.json` format with `applies_to: "local"`, as a deliberate one-time exception to "legacy versions are not retrofitted" — it's purely local-scoped (writes only to `.claude/state/arcanum-config.json`), was gated exclusively by the committed pointer under the old scheme (the exact bug this issue fixes), and shipped only the day before this refinement, so the blast radius of correcting it now is small. Manifest+scope discovery is therefore supported starting with `0.12.0` onward; the runner needs to support both discovery mechanisms going forward: legacy glob for `0.9.3`, manifest for `0.12.0` and later.

**Accepted trade-off:** repos that already upgraded to `0.12.0` and ran it under today's system have committed version ≥ `0.12.0` but no local pointer yet (it doesn't exist until this issue ships). After this ships, such a repo's local pointer reads as absent (→ `0.0.0`), so it will see `0.12.0`'s now-local entry as pending and re-run it — and `repo_config_write` unconditionally overwrites `plan-issues.max-retry-count`/`error-sleep-time` back to the defaults (`5`/`5`) rather than only setting them if absent. This is accepted as a one-time, low-risk consequence of the retrofit (same default values get rewritten, only clobbering a value if a user had already customized this obscure retry/backoff config since upgrading to `0.12.0`) rather than a reason to special-case the write.

### `generate_next.sh` becomes manifest-aware

Today it globs `repos/next/[0-9][0-9][0-9].sh` and returns (highest number found) + 1 — only ever looking at `.sh` files. It needs to instead read `migrations.json` and take (highest existing `id` across all entries) + 1.

`repos/next/.keep` goes away — every version folder (including `next/`) always has a `migrations.json` present (`[]` when nothing is pending), so the empty directory no longer needs a placeholder file to stay tracked by git.

### `init-claude` stamps both version pointers

`init-claude`'s `scripts/stamp_arcanum_version.sh` currently only writes `.version` into the committed `.claude/configuration/arcanum-repo-config.json`. It needs to stamp the new local pointer too, for the same reason it stamps the committed one today: a freshly-set-up repo shouldn't be told it has a backlog to catch up on, on either axis.

This is also what makes the two-clones scenario resolve itself correctly without any extra machinery: `init-claude` runs once, when a repo is first set up, typically on one clone. Cloning that same repo to a second machine later doesn't re-run `init-claude` (`.claude/configuration/` already exists, pulled via git) — so the second clone's `.claude/state/` is never stamped, its local version reads as absent (→ `0.0.0`), and it correctly discovers every `local`-scoped entry as pending, running them for real.

### Documentation

`docs/guides/arcanum-repo-version.md` and `docs/guides/arcanum-repo-config.md` are updated to document the `migrations.json` schema (`id`/`type`/`file`/`skippable`/`applies_to`), the second local version pointer (`.claude/state/arcanum-config.json`'s `.migrations.version`), and the resulting single-loop dual-gating behavior — matching this repo's convention of keeping the directly-affected end-user guides in sync with user-visible behavior changes.

### Out of scope (belongs to sub-issue #150 — Support AI-instruction migrations via manifest entries)

- `type: "instructions"` entries and the two-file (`<id>.md` + `<id>.instructions.md`) split
- Generalizing the exit-3/`CHAT_CONTEXT` hand-off into an unconditional `AI_INSTRUCTIONS=<version>/<id>` signal
- The completion ledger (`.claude/state/arcanum-migrations-ledger.json`) and per-entry resume-without-replay — not needed here, since pure `script` versions keep resuming via idempotent replay, unchanged from today
- `generate_next.sh --type instructions` support

## Benefits

- Fixes the false "fully caught up" signal a second (or later) clone gets today when a `local`-scoped migration's effects never travel through git — each clone now independently tracks and applies what it actually needs.
- Fixes the pre-existing per-file version-advance bug, so a halted, partially-applied version is correctly retried in full instead of being treated as already passed — this benefits legacy versions too, via the shared runner code path.
- Establishes the `migrations.json` schema and dual-pointer (committed + local) mechanism that sub-issue #150 (AI-instruction migrations) builds directly on top of, avoiding a breaking schema change later.
- Keeps `docs/guides/arcanum-repo-version.md` and `docs/guides/arcanum-repo-config.md` accurate for anyone authoring or debugging migrations going forward.
