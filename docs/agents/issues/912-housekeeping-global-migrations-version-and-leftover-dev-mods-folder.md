# Issue: Housekeeping: global migrations.version and leftover dev-mods folder

## Description
Part of #900.

Investigate and decide two leftovers seen in the ward session:

- **Global `migrations.version`** — `~/.claude-*/arcanum-config.json` held `migrations.version: 2.3.0` while the install and repo were at 2.3.1.
- **`dev-mods/<uuid>` folder under the Claude root** — is it created by arcanum and left behind, or is it Claude Code's own?

Owner: architect. Depends on: none.

## Problem
### Global `migrations.version` — resolved (from #901)
The global `migrations.version` is the third migration-scope pointer (see `docs/guides/arcanum-repo-version.md`), read and written by `arcanum/migrations/run.sh` through `global_config_get_version`/`global_config_set_version`, never through the config chain. It only advances when a version's manifest has a `global`-scoped entry. 2.3.1 has none, so a global pointer at 2.3.0 is correct, not behind. Nothing to fix; the registry gap it revealed (`migrations.version` declared local-only in `keys.json`) moved to #907.

### `dev-mods/<uuid>` — finding
- Arcanum never writes `dev-mods`: no file in the repo references `dev-mods`, `dev_mods` or `devMods`.
- Each `<uuid>` is a Claude Code **session id**: `~/.claude-darthjee/dev-mods/eb7c37c3-…` and `~/.claude-favini/dev-mods/72375a51-…` match session transcripts under `projects/`, both from 2026-10-16, the day the `arcanum-next-step` mod was built (#797).
- Both sessions loaded Claude Code's built-in `plugin-authoring` skill, which scaffolds work-in-progress mods into `<claude root>/dev-mods/<session-id>/`. The `favini` folder still holds a `handoff-test` scaffold (`.claude-plugin/`, `hooks/hooks.json`, `hooks/register.ts`, `tsconfig.json`); the `darthjee` one is empty.

So the folder is Claude Code's own scratch area, left over from mod development. It is not an arcanum artifact.

## Expected Behavior
Arcanum does not create, manage or clean up `dev-mods/`. The finding is recorded so the question does not come up again, and leftover folders can be removed by hand.

## Solution
- No code change and no migration in arcanum. Cleaning up a Claude Code–owned folder is outside arcanum's scope.
- Add a short note to `arcanum-next-step/README.md` (owner: `mod` agent) saying that `<claude root>/dev-mods/<session-id>/` comes from Claude Code's `plugin-authoring` skill, is not used by arcanum, and can be deleted safely.
- Optional, by hand: delete the leftover `<claude root>/dev-mods/` folders locally (not part of the PR).

## Benefits
Closes the last open question in #900's housekeeping, and keeps arcanum from taking over cleanup of folders it does not own.
