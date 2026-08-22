# scripter Plan: Migrate permission-grant entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts", in particular: only the CLI-dispatcher path (`permission_grant.sh add <file> <pattern>` run as a script) gets `engine_dispatch`-routed to the `permission-grant` native command; the sourced-function path (`permission_grant_add`, called in-process by `arcanum/migrations/repos/*/*.sh`) must keep working unchanged as pure shell. Use `repo_path="$(pwd)"` for `engine_dispatch`'s required `<repo_path>` argument, since `permission_grant.sh`'s CLI has none of its own.

## Implementation Steps

### Step 1 — Split `permission_grant.sh` into a shim + `permission_grant_shell.sh`

Following the `checkout_safe_branch.sh`/`checkout_safe_branch_shell.sh` shape:

- New `arcanum/_lib/permission_grant_shell.sh`: the shell implementation — `permission_grant_add` (moved verbatim, still sourcing `lock.sh`) plus, at the bottom, the same direct-invocation CLI dispatcher (`case "${1:-}" in add) ... ; *) usage ;; esac`) the original file had. This is both the `engine_dispatch` fallback and (via the `permission_grant.sh` shim below) still directly sourceable.
- `arcanum/_lib/permission_grant.sh` becomes: (1) unconditionally `source`s `permission_grant_shell.sh` at the top, so every existing `source ".../permission_grant.sh"` call site keeps getting `permission_grant_add` for free, with zero call-site changes needed; (2) at the bottom, replaces the old inline case-dispatch with an `engine_dispatch`-guarded one — same `add`/usage validation as before (kept in the shim too, mirroring how `checkout_safe_branch.sh` keeps its own `[[ -n "$REPO_PATH" ]]` check alongside `checkout_safe_branch_shell.sh`'s), but on the `add` branch calls `engine_dispatch "$(pwd)" permission-grant "${SCRIPT_DIR}/permission_grant_shell.sh" -- add "$@"` instead of calling `permission_grant_add` directly.
- No environment-variable allowlist needed for the native path — like `checkout-safe-branch`, this is purely filesystem-based (no env dependency beyond `PATH`, which `engine_dispatch` always includes).

### Step 2 — Flip the migration flag and regenerate the status doc

Set `"permission-grant": true` in `arcanum/_lib/migration-status.json` (only once node's `PermissionGrant.js` + `core/bin/arcanum` wiring from [node.md](node.md) are in place and passing tests). Regenerate `docs/agents/architecture/entrypoint-migration-status.md` by running `scripts/generate_entrypoint_migration_status.sh` and committing its output.

## Files to Change

- `arcanum/_lib/permission_grant.sh` — becomes the thin `engine_dispatch` shim (CLI path only) + unconditional `source` of `permission_grant_shell.sh` (function path).
- `arcanum/_lib/permission_grant_shell.sh` — new file, the shell implementation moved out of `permission_grant.sh`.
- `arcanum/_lib/migration-status.json` — flip `permission-grant` to `true`.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output.

## Notes

- Do not touch `arcanum/migrations/repos/0.16.0/*.sh` / `0.17.2/*.sh` — they `source permission_grant.sh` and call `permission_grant_add` directly; the split above is specifically designed to leave that call path untouched.
- No CI job currently lints/tests `arcanum/_lib/*.sh` directly (the CircleCI `test`/`lint` jobs only cover `core/`) — verify this split manually (source the shim and call `permission_grant_add`; run the CLI form in both `engine.mode=shell` and `engine.mode=native`) rather than relying on a CI gate.
