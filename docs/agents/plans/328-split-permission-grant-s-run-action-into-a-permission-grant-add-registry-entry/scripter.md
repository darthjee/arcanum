# scripter Plan: Split permission-grant's run(action, …) into a permission-grant-add registry entry

Main plan: [plan.md](plan.md)

## Shared contracts

- The engine command name becomes `permission-grant-add` — used as the 2nd arg to
  `engine_dispatch` in `permission_grant.sh` and as the key in
  `migration-status.json`. Must match the `core/lib/core/commands.js` registry key
  exactly (node's work).
- `permission_grant.sh` must pass the post-`--` passthrough as
  `"$anchor" "$@"` (i.e. `<anchor> <file> <pattern>`) — the literal `add` verb
  token is **removed** from what is forwarded. Native dispatch then calls
  `PermissionGrant#add(file, pattern)` after the anchor is stripped.
- `engine_dispatch` forwards the identical post-`--` list to the shell fallback,
  so `permission_grant_shell.sh`'s CLI dispatcher must accept
  `<anchor> <file> <pattern>` (3 args, no `add`), with its
  `case "${1:-}" in add) … *)` removed.
- The outward human/agent CLI stays `permission_grant.sh <anchor> add <file> <pattern>`
  — `permission_grant.sh` keeps validating that `add` verb, it just doesn't
  forward it.
- The `*)` usage-error branch in `permission_grant_shell.sh` is deleted — the
  "unrecognized action" concept is gone on both sides (node drops the matching
  native path and specs).
- `node`'s `core/spec/bin/permissionGrantParity_spec.js` invokes
  `bash permission_grant_shell.sh <cwd> <file> <pattern>` directly — keep that
  3-arg shape working.

## Steps

- [01 — Update permission_grant.sh engine_dispatch call](scripter/01-update-permission-grant-sh.md)
- [02 — Simplify permission_grant_shell.sh CLI dispatcher](scripter/02-simplify-permission-grant-shell-sh.md)
- [03 — Rename the migration-status.json key](scripter/03-rename-migration-status-key.md)
- [04 — Regenerate entrypoint-migration-status.md](scripter/04-regenerate-entrypoint-migration-status.md)

## CI Checks

- No `shellcheck` CI job and no freshness check for
  `entrypoint-migration-status.md`. Validate locally with `bash -n` on both
  scripts and by running `core/` `yarn test` (the parity spec exercises the real
  scripts).

## Notes

- Do **not** touch the `permission_grant_add()` function in
  `permission_grant_shell.sh` — only the `if [[ "${BASH_SOURCE[0]}" == "$0" ]]`
  CLI-dispatcher block at the bottom changes. The function is called in-process by
  `arcanum/migrations/repos/*/*.sh`.
- The regenerated `entrypoint-migration-status.md` row will show `#328` instead of
  `#230` in the Issue column — this is expected and accepted (see plan Notes).
