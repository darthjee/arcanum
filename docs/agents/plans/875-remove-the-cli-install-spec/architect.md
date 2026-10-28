# Architect Plan: Remove the CLI install spec

Main plan: [plan.md](plan.md)

## Shared contracts

Use the old → new citation table in [plan.md](plan.md#shared-contracts). You run the final grep check after scripter and client are done.

## Implementation Steps

### Step 1 — Delete the spec and its index row

- `git rm -r docs/agents/specs/cli-install.md docs/agents/specs/cli-install/` (the index plus `install.md`, `update.md`, `already-installed.md`, `self-update.md`).
- Remove the CLI Install row from `docs/agents/specs.md`. Leave the intro and the Shell Engine Removal row unchanged.
- Sweep the markdown docs (`docs/`, `README.md`, skill `*.md` files) for `specs/cli-install` or relative `cli-install/<part>.md` links into the spec. None are known: #874 repointed `install-and-release.md`, `script-engine.md` and `arcanum-cli.md`. Links to `architecture/cli-install.md` and the `make cli-install` target are unrelated and stay.

### Step 2 — Repoint comments in unowned scripts, then verify

Only the comment text changes, and each new comment keeps the old meaning:

- `arcanum/install/installer.sh` lines ~15 and ~86: `docs/agents/specs/cli-install/install.md` → `docs/agents/architecture/cli-install.md`, "Callers" → "Installer". Re-wrap the comment lines if needed.
- `arcanum/install/test_installer.sh` line 3: same target.
- `arcanum/update/updater.sh` lines ~10 and ~176, `arcanum/update/test_updater.sh` line 3: → `docs/agents/architecture/cli-install.md`, "Callers" → "Zip updater".
- `arcanum/update/bootstrap.sh` line ~172, `arcanum/update/test_update_bootstrap.sh` line 3: → `docs/agents/architecture/cli-install.md`, "Callers" → "`git clone` path".
- `arcanum/migrations/repos/next/001.sh` line 8: `# Spec: docs/agents/specs/cli-install/update.md, "Global migration".` → `# See docs/agents/architecture/cli-install.md, "Callers" → "Global migration".` It is a pending migration; this comment change does not change its behavior or version. Leave `001.md` alone unless it cites the spec (it does not today).

Then run the final check from [plan.md](plan.md#shared-contracts) and the four standalone bash tests to confirm nothing broke:

```bash
bash arcanum/install/test_installer.sh
bash arcanum/update/test_updater.sh
bash arcanum/update/test_update_bootstrap.sh
bash arcanum/_lib/test_install_cli.sh
```

## Files to Change

- `docs/agents/specs/cli-install.md` — deleted.
- `docs/agents/specs/cli-install/` (4 files) — deleted.
- `docs/agents/specs.md` — remove the CLI Install row.
- `arcanum/install/installer.sh`, `arcanum/install/test_installer.sh` — comment only.
- `arcanum/update/updater.sh`, `arcanum/update/test_updater.sh` — comment only.
- `arcanum/update/bootstrap.sh`, `arcanum/update/test_update_bootstrap.sh` — comment only.
- `arcanum/migrations/repos/next/001.sh` — comment only.

## Notes

- No specialist explicitly owns `arcanum/install/`, `arcanum/update/` or `arcanum/migrations/`, so the architect repoints those.
- Do not edit `docs/agents/issues/` or `docs/agents/plans/`; they are historical.
