# Guide: Tracking This Repo's Arcanum Version

Separate from the arcanum *install's own* version (tracked in `arcanum.json` at the root of the arcanum install itself, updated by `/arcanum-update`), this repo also tracks which version of arcanum it was last **configured** against — i.e. which per-repo structural changes (renamed/moved config files, new folders, new config shapes) it has already caught up on.

There are actually **two** such pointers — a committed one, shared by every clone via git, and a local-only one, tracked independently per clone/machine. See "Two pointers, not one" below for why.

## Where they live

**Committed pointer:** `.claude/configuration/arcanum-repo-config.json`, top-level `.version` field (a plain semver string, not nested under any feature's namespace):

```json
{
  "version": "0.6.0",
  "auto-fix-all": { "...": "..." }
}
```

**Local pointer:** `.claude/state/arcanum-config.json` (gitignored — local per clone/machine, never travels through git), namespaced under `.migrations.version`:

```json
{
  "migrations": { "version": "0.12.0" }
}
```

## Two pointers, not one

`.claude/configuration/` is committed and shared across every clone via git; `.claude/state/` is gitignored and local to each clone. A migration whose effects live in `.claude/state/` is invisible to git — if Clone A runs it and pushes, Clone B pulls and sees the committed `.version` already advanced (the version bump and any committed-side effects ship in the same commit), and would wrongly conclude it's fully caught up even though its own `.claude/state/` was never touched.

Each per-repo migration entry (see `arcanum/migrations/repos/<version>/migrations.json`) declares which pointer answers its "done?" question, via `applies_to`:

- **`"repo"`** — satisfied once the **committed** pointer reaches this entry's version folder. One clone running it (and committing/pushing the result) satisfies every clone that later pulls that commit — same all-or-nothing-per-version behavior migrations have always had.
- **`"local"`** — satisfied once *that clone's own* **local** pointer reaches this entry's version folder. Every clone must independently apply it — the local pointer can lag the committed one by an arbitrary amount per clone, since it never travels through git.

`arcanum/migrations/run.sh` walks a single loop over the union of both pointers' pending versions (not two separate passes), so entries stay in their authored relative order within a version even when they mix scopes. See `docs/agents/architecture.md`'s "Per-Repo Migrations" section for the full `migrations.json` schema and runner-chain details.

## A third tracker, just for `type: "instructions"` entries

The two pointers above answer "has this version's manifest been fully processed?" — but a `type: "instructions"` entry (see `docs/agents/architecture.md`) hands its work off to the AI rather than running a script, and that hand-off is the *normal* way through such an entry, not a rare detour. Resuming mid-manifest can't rely on script idempotency the way replaying a `type: "script"` entry can, so a third, per-entry tracker — `.claude/state/arcanum-migrations-ledger.json`, managed via `arcanum/migrations/_ledger.sh`/`ledger.sh` — records which `instructions` entries have already been completed. It's consulted *in addition to*, not instead of, whichever version pointer the entry's `applies_to` answers to: `update_per_version.sh` treats an `instructions` entry as satisfied once either the relevant pointer has advanced past its version, or the ledger has it marked complete — whichever comes first — so a resume always continues from the first not-yet-completed entry instead of re-triggering the AI hand-off for one already handled. Unlike the two pointers, the ledger is never reset and is not itself a version pointer — it doesn't gate anything on its own, it only prevents replay within an already-pending version.

## Who reads and writes them

- **`init-claude`** stamps both automatically, near the end of its flow (`init-claude/setup_arcanum_version.md`), with the version of the arcanum install `init-claude` is currently running from — best-effort: if that install isn't checked out on a resolvable release version (e.g. a `git clone` not sitting on a release tag), the stamp is skipped rather than writing something wrong. This is also what makes the two-clones scenario above resolve itself correctly without any extra machinery: `init-claude` typically runs once, on one clone; a second clone of the same repo never re-runs it (`.claude/configuration/` already exists, pulled via git), so its local pointer is correctly left unstamped (absent → `0.0.0`), and it discovers every `local`-scoped entry as still pending.
- **`arcanum/migrations/run.sh`** (driven by `/arcanum-migrate`) reads both to decide which per-repo migrations, if any, are still pending, and advances each independently — once a version's entire manifest is processed without halting, the committed pointer advances if that manifest has any `repo`-scoped entry, and the local pointer advances if it has any `local`-scoped entry (never per-file, and never for a scope the manifest doesn't use).

## What happens if either is missing or invalid

- **Missing entirely** (file absent, or present without the relevant `.version` field) — treated as `0.0.0`, meaning every migration gated by that pointer is considered pending. `arcanum/migrations/run.sh` prints a warning pointing at this guide when that happens, so it's not a silent surprise the first time `/arcanum-migrate` runs against an older, never-stamped repo (or clone).
- **Present but not valid semver** (`X.Y.Z`, no `v` prefix, no pre-release/build suffix) — `arcanum/migrations/run.sh` hard-errors instead of guessing, for either pointer. Silently falling back to `0.0.0` here would risk re-running migrations that were already safely applied. Fix the field by hand (see below) and try again.

## Setting them manually

You can edit either `.version` field directly — useful to skip straight past migrations you know don't apply (e.g. bootstrapping these files for a repo/clone you know is already caught up, without replaying every migration):

```bash
# Committed pointer
jq '.version = "0.6.0"' .claude/configuration/arcanum-repo-config.json > /tmp/arcanum-repo-config.json.tmp \
  && mv /tmp/arcanum-repo-config.json.tmp .claude/configuration/arcanum-repo-config.json

# Local pointer
jq '.migrations.version = "0.12.0"' .claude/state/arcanum-config.json > /tmp/arcanum-config.json.tmp \
  && mv /tmp/arcanum-config.json.tmp .claude/state/arcanum-config.json
```

Make sure the value is a plain `X.Y.Z` string — no `v` prefix, no extra whitespace.
