# Ensure issues are always connected to a GitHub issue

## Context

Skills that deal with issue files currently allow an issue's ID to be either a numerical ID or a local placeholder string of the form `X01`, `X02`, etc. Numerical IDs always correspond to a real GitHub issue; the `X##` placeholders do not — they only exist as local files under `docs/agents/issues`, with no GitHub counterpart. This breaks the assumption that every issue file is traceable to a GitHub issue, and the scripts that handle issue IDs do not validate that an ID is numeric, so local-only IDs can flow through unnoticed.

## What needs to be done

Remove the `X##` local-only id convention entirely, so that every issue file is always backed by a real, numeric GitHub issue.

- `new-issue`: when no numeric id is known (no `#<id>` given and no existing file matches), do not auto-assign an `X##` id. Instead, tell the user an id is missing and ask whether they have an existing GitHub issue number or want a new GitHub issue created now (which yields the real numeric id via the GitHub API). Add a `create <title> <file>` command to `new-issue/scripts/github.sh` (POST to the GitHub issues API, mirroring the existing `update` command) to support this. Update `new-issue/scripts/resolve_id_and_file.sh` to drop the `next_x_id`/`X##` generation and report a missing-id status instead. Treat any explicitly-given non-numeric id (e.g. `#X01`) as a hard error.
- `plan-issue` and `fix-issue`: when given a non-numeric id, stop immediately with a clear error message rather than guessing or resolving it.
- `auto-new-issue` (fully autonomous, never asks the user): when no numeric id is known, mint a real GitHub issue itself via the same new `create` command (own copy of the script) before writing/committing the file — never invent a local id.
- `auto-plan-issue` and `auto-fix-issue`: their `resolve_plan_paths.sh` scripts must reject non-numeric ids with a hard error.
- `auto-fix-issue/SKILL.md`: stop documenting `X01`-style local ids as an accepted input format.

## Acceptance criteria

- [ ] `new-issue` no longer generates `X##` ids; missing-id cases prompt the user to confirm creating a new GitHub issue or to provide an existing number.
- [ ] `new-issue/scripts/github.sh` and `auto-new-issue/scripts/github.sh` each gain a `create <title> <file>` command that creates a GitHub issue and returns its numeric id.
- [ ] `auto-new-issue` autonomously mints a GitHub issue (via `create`) when no numeric id is known, instead of using a local placeholder.
- [ ] `plan-issue`, `fix-issue`, `auto-plan-issue`, and `auto-fix-issue` reject non-numeric ids with a clear error and stop.
- [ ] No remaining references to the `X##` local-id convention in any skill or script.

---
See issue for details: https://github.com/darthjee/arcanum/issues/4
