# Issue: arcanum-update fails on git installs when untracked files (e.g. synced/) exist

## Description
`/arcanum-update` refuses to update a git-clone install when the target has **untracked** files, even when no tracked file has been modified.

On an install at `~/.claude/skills` (arcanum `0.22.1`, method `git`), Claude Code created an untracked `synced/` folder in the skills directory (it holds a `.bucket-<uuid>` marker file and a `<uuid>` subfolder, about 4 MB). After that, every update attempt fails:

```text
Resolving latest release of darthjee/arcanum...
Error: /Users/darthjee/.claude/skills has uncommitted changes.
Commit, stash, or discard them, then re-run.
```

`git status --short` in the target shows only `?? synced/`.

Workaround: add `synced/` to `.git/info/exclude` in the install clone.

## Problem
`arcanum/update/bootstrap.sh` (git-clone branch, around line 129) uses the full porcelain status as its dirty check:

```bash
if [[ -n "$(git -C "$TARGET" status --porcelain)" ]]; then
```

That counts untracked files. The `synced/` folder is written by the Claude Code host, so it isn't user work. The user can't reasonably commit, stash or discard it, and it will likely come back. This is the only dirty check in the update flow: the Node (`core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`) and shell (`arcanum-update/scripts/run_update_*.sh`) entrypoints both delegate to `bootstrap.sh`. No spec covers `bootstrap.sh`'s git-install path today.

## Expected Behavior
- Untracked files don't block a git-clone update.
- Modified or staged **tracked** files still block it, with the same error.
- If an untracked file would be overwritten by the target version, `git checkout` itself still refuses, so the update fails safely instead of clobbering it.
- `synced/` no longer shows up as untracked in a git-clone install.

## Solution
1. **Tracked-only dirty check.** In `arcanum/update/bootstrap.sh`, change the check to:

   ```bash
   if [[ -n "$(git -C "$TARGET" status --porcelain --untracked-files=no)" ]]; then
   ```

   No change is needed in the `arcanum-update` skill scripts or the Node counterpart, since both call `bootstrap.sh`.
2. **Ignore the host folder.** Add `synced/` to the repo's root `.gitignore`, so a git-clone install (which is a clone of this repo) no longer lists it as untracked.
3. **Regression spec.** Add a Jasmine spec under `core/spec/` that runs `bootstrap.sh` against a temporary git-clone install:
   - a local bare repo as `origin` with two tags; the install clone is checked out on the older tag and holds `arcanum/update/bootstrap.sh`
   - run it with `ARCANUM_VERSION=<newer tag>` (skips the GitHub lookup) and `ARCANUM_ASSUME_YES=1`
   - cases: an untracked file (e.g. `synced/marker`) → update succeeds and HEAD is on the newer tag; a modified tracked file → exits nonzero with the "uncommitted changes" error and HEAD stays put.

## Benefits
- Git-clone installs keep updating even when the Claude Code host drops its own files into the skills directory.
- No manual `.git/info/exclude` workaround needed.
- Safety is unchanged: tracked edits still block the update, and `git checkout` still protects untracked files it would overwrite.
- The git-install update path gets test coverage for the first time.
