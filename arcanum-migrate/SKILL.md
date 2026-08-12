---
name: arcanum-migrate
description: Walks this repo through pending per-repo structural changes (renamed/moved config files, new folders, new config shapes) introduced by newer arcanum versions since this repo's arcanum install last caught up — distinct from `/arcanum-update`, which updates the arcanum install itself, not artifacts inside this consuming repo. Reads the repo's recorded arcanum version from `.claude/configuration/arcanum-repo-config.json`, lists any pending migrations, asks for explicit confirmation naming what would run ([A]ll/[N]one/[S]elect), then applies them and relays their output live. Usage: /arcanum-migrate
---

You are acting as the **architect**. Your job is to walk this repo through any pending per-repo migrations for the arcanum install it lives inside — one round of chat-level confirmation, then hand off to the deterministic scripts. No further questions once confirmed beyond picking which versions, if `[S]elect` is chosen; no auto-retry on failure.

## Step 1 — Check for pending migrations

Run:

```bash
../arcanum/migrations/run.sh check
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`).

- **Nonzero exit** — the recorded `.version` in `.claude/configuration/arcanum-repo-config.json` isn't valid semver. Relay the script's stderr verbatim and stop — this needs manual correction (see `docs/guides/arcanum-repo-version.md`), no auto-fix.
- **Exit 0** — parse `CURRENT=<version>` (first line) and then either `STATUS=up_to_date` or one or more `PENDING=<version>` lines (ascending order).
  - `STATUS=up_to_date` — report: "This repo is already up to date (version `<CURRENT>`)." Stop here.
  - One or more `PENDING=<version>` lines — continue to Step 2.

If `CURRENT` was not actually found in the config file (the underlying script treats a missing/absent version as `0.0.0` and prints a warning to stderr pointing at `docs/guides/arcanum-repo-version.md` in that case), relay that warning to the user alongside the version list below so they understand why every migration is pending.

## Step 2 — Ask for confirmation

Present the current version and the full pending list in conversation, e.g.:

> This repo is at version `<CURRENT>`. The following migrations are pending, in order: `<PENDING-1>`, `<PENDING-2>`, ... . Run **[A]ll**, **[N]one**, or **[S]elect** specific ones?

Wait for an explicit answer.

- **`[N]one`** — acknowledge and stop. Nothing was touched, this is not an error.
- **`[A]ll`** — continue to Step 3 with every pending version, in the listed order.
- **`[S]elect`** — ask which of the pending versions (from the list above) to run, confirm the resulting subset with the user, then continue to Step 3 with just that subset, in ascending order.

## Step 3 — Apply

For `[A]ll`, run once, relaying its stdout/stderr live to the user as it streams (do not hide it behind a summary):

```bash
../arcanum/migrations/run.sh apply --all
```

For `[S]elect`, run once per chosen version, in ascending order, each time relaying its stdout/stderr live before moving to the next one:

```bash
../arcanum/migrations/run.sh apply --select <version>
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`), same as Step 1.

Each `apply` call already prints any collected errors (skippable or halting) at the end of its own run — that output is part of what you're relaying live, no need to re-summarize it separately.

- **Exit 0** — the run completed with no halting failure (it may still have recorded skippable errors, already visible in the relayed output). If running multiple selected versions, continue to the next one; once all are done, report success and the new recorded version.
- **Exit 1** — a non-skippable migration failed partway through; the recorded version is frozen at the last fully-clean point (already reported by the script's own output). Stop — do not continue to any further selected versions. Tell the user the run halted, point at the relayed error detail, and note that migration scripts are expected to be idempotent, so re-running `/arcanum-migrate` after a fix is safe and will resume from the same point.
