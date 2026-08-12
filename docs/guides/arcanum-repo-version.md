# Guide: Tracking This Repo's Arcanum Version

Separate from the arcanum *install's own* version (tracked in `arcanum.json` at the root of the arcanum install itself, updated by `/arcanum-update`), this repo also tracks which version of arcanum it was last **configured** against — i.e. which per-repo structural changes (renamed/moved config files, new folders, new config shapes) it has already caught up on.

## Where it lives

`.claude/configuration/arcanum-repo-config.json`, top-level `.version` field (a plain semver string, not nested under any feature's namespace):

```json
{
  "version": "0.6.0",
  "auto-fix-all": { "...": "..." }
}
```

## Who reads and writes it

- **`init-claude`** stamps it automatically, near the end of its flow (`init-claude/setup_arcanum_version.md`), with the version of the arcanum install `init-claude` is currently running from — best-effort: if that install isn't checked out on a resolvable release version (e.g. a `git clone` not sitting on a release tag), the stamp is skipped rather than writing something wrong.
- **`arcanum/migrations/run.sh`** (driven by `/arcanum-migrate`) reads it to decide which per-repo migrations, if any, are still pending: every version folder under `arcanum/migrations/repos/` strictly greater than the recorded version.

## What happens if it's missing or invalid

- **Missing entirely** (file absent, or present without a `.version` field) — treated as `0.0.0`, meaning *every* migration currently shipped is considered pending. `arcanum/migrations/run.sh` prints a warning pointing at this guide when that happens, so it's not a silent surprise the first time `/arcanum-migrate` runs against an older, never-stamped repo.
- **Present but not valid semver** (`X.Y.Z`, no `v` prefix, no pre-release/build suffix) — `arcanum/migrations/run.sh` hard-errors instead of guessing. Silently falling back to `0.0.0` here would risk re-running migrations that were already safely applied. Fix the field by hand (see below) and try again.

## Setting it manually

You can edit `.version` directly — useful to skip straight past migrations you know don't apply (e.g. bootstrapping this file for a repo you know is already caught up, without replaying every migration):

```bash
jq '.version = "0.6.0"' .claude/configuration/arcanum-repo-config.json > /tmp/arcanum-repo-config.json.tmp \
  && mv /tmp/arcanum-repo-config.json.tmp .claude/configuration/arcanum-repo-config.json
```

Make sure the value is a plain `X.Y.Z` string — no `v` prefix, no extra whitespace.
