# Scripter Plan: arcanum-update fails on git installs when untracked files (e.g. synced/) exist

Main plan: [plan.md](plan.md)

## Shared contracts

This agent produces the dirty-check behavior in `plan.md`'s "Shared contracts": tracked changes only, with the error text and exit code unchanged.

## Implementation Steps

### Step 1 — Tracked-only dirty check in bootstrap.sh
In `arcanum/update/bootstrap.sh`'s git-clone branch (around line 129), change `git -C "$TARGET" status --porcelain` to `git -C "$TARGET" status --porcelain --untracked-files=no`. Keep the error message and `exit 1` exactly as they are. Add a short comment explaining why untracked files are ignored: the host (e.g. Claude Code's `synced/`) can write them into the install, and `git checkout` already refuses to overwrite an untracked file.

### Step 2 — Ignore synced/ and update the architecture doc
- Add `synced/` to the root `.gitignore`. A git-clone install is a clone of this repo, so the entry hides the host folder from `git status` there.
- In `docs/agents/architecture/install-and-release.md` (the git-clone paragraph, around line 17), change "checks `git status --porcelain`" to say the check covers **tracked** changes only (`--untracked-files=no`). Note that untracked files don't block the update and that `git checkout` still protects untracked files it would overwrite.

## Files to Change
- `arcanum/update/bootstrap.sh` — dirty check limited to tracked changes
- `.gitignore` — add `synced/`
- `docs/agents/architecture/install-and-release.md` — describe the new dirty-check semantics

## Notes
- Nothing needs to change in `arcanum-update/scripts/*.sh` or `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`. Both just run `bootstrap.sh`.
