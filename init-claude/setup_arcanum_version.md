# Stamp the Arcanum Version

Record the version of this arcanum install into the repo being configured, so `arcanum/migrations/run.sh` (used by `/arcanum-migrate`) can later tell which per-repo migrations are still pending. This step is silent/best-effort — it never blocks the rest of `init-claude`.

## Step 1 — Resolve and write the version

Run:

```bash
scripts/stamp_arcanum_version.sh
```

> Resolve `scripts/stamp_arcanum_version.sh` relative to the `init-claude` skill folder.

This resolves the current arcanum install's version (from `arcanum.json` for a zip install, or the exact git tag for a `git clone` install) and, if it's a valid semver version, writes it to both `.version` in `.claude/configuration/arcanum-repo-config.json` (the committed pointer) and `.migrations.version` in `.claude/state/arcanum-config.json` (the local-only pointer — see `docs/guides/arcanum-repo-version.md` for why there are two). If the version can't be resolved as valid semver (e.g. a git clone not checked out on a release tag), it skips both writes — `arcanum/migrations/run.sh` already treats either missing pointer as `0.0.0` and warns, which is an acceptable fallback for this case.

## Step 2 — No confirmation needed

This step never asks the user anything and never reports failure — just silently continue to the next step regardless of the outcome.
