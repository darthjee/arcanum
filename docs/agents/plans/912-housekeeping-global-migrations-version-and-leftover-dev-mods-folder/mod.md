# Mod Plan: Housekeeping: global migrations.version and leftover dev-mods folder

Main plan: [plan.md](plan.md)

## Overview
Add a short note to `arcanum-next-step/README.md` explaining the `dev-mods/` folder that can show up under the Claude root after mod development. No code change and no migration.

## Context
- Arcanum never references `dev-mods`, `dev_mods` or `devMods` anywhere in the repo.
- Each `dev-mods/<uuid>` is a Claude Code session id. The folders seen locally match the 2026-10-16 sessions where the `arcanum-next-step` mod was built (#797). Both sessions loaded Claude Code's built-in `plugin-authoring` skill, which scaffolds work-in-progress mods into `<claude root>/dev-mods/<session-id>/`. One folder still held a `handoff-test` scaffold; the other was empty.
- The global `migrations.version` half of the issue was resolved in #901 (it is a legitimate global migration pointer); its registry gap moved to #907. Nothing to do for it here.

## Implementation Steps

### Step 1 — Document `dev-mods/` in the mod README
In `arcanum-next-step/README.md`, under `## Development`, add a short paragraph (or a `### Leftover dev-mods folders` subsection) that says:
- `<claude root>/dev-mods/<session-id>/` (e.g. `~/.claude/dev-mods/…`, or under `$CLAUDE_CONFIG_DIR`) is created by Claude Code's `plugin-authoring` skill when a mod is scaffolded or developed in a session. The folder name is that session's id.
- Arcanum neither creates, reads nor cleans it, and the shipped mod does not load from it.
- It is safe to delete once the session's mod work has been copied into this folder.

Keep it to a few lines, in the README's existing plain style.

## Files to Change
- `arcanum-next-step/README.md` — add the `dev-mods/` note under `## Development`.

## CI Checks
- No CI job covers README-only changes. Optionally run `make mod-check` to confirm the mod still validates.

## Notes
- Do not add a migration or cleanup script: the folder belongs to Claude Code, so arcanum stays out of it.
- Deleting the local leftover folders is a manual step for the user and is not part of the PR.
