# Plan: Split permission-grant's run(action, …) into a permission-grant-add registry entry

Issue: [328-split-permission-grant-s-run-action-into-a-permission-grant-add-registry-entry.md](../issues/328-split-permission-grant-s-run-action-into-a-permission-grant-add-registry-entry.md)

## Overview

`permission-grant` is the last native command-registry entry that maps to a
generic `method: 'run'` and dispatches internally on `action === 'add'`. This
plan replaces it with a dedicated `permission-grant-add` entry mapped straight to
`method: 'add'` (keeping `context: 'claude'`, since #321 has landed), deletes the
now-dead `run` / `USAGE_MESSAGE` on `PermissionGrant`, and stops the literal
`add` verb token from being forwarded through the shell shim — the verb now lives
only in the command name, mirroring the `github-issue-{info,create}` precedent.
Tracking files (`migration-status.json`, `entrypoint-migration-status.md`) are
updated to match.

## Agents involved

- [node](node.md) — the `core/` registry entry, `PermissionGrant` class, and the four affected specs.
- [scripter](scripter.md) — the `arcanum/_lib` shell shims, `migration-status.json`, and the regenerated architecture doc.

## Shared contracts

These are the exact interface points where the two agents' work must agree. All
changes land together on the same branch, so there is no ordering dependency, but
the parity spec (node) exercises the real shell scripts (scripter) end-to-end —
both sides must match or `yarn test` fails.

### 1. Engine command name: `permission-grant` → `permission-grant-add`

The kebab string `permission-grant-add` is the single routing key shared across:

- **node**: the `COMMANDS` registry key in `core/lib/core/commands.js`; the
  `core/bin/arcanum` first positional (routes generically off `COMMANDS`, no
  hardcode); the command strings in `commands_spec.js`, `dispatcher_spec.js`, and
  the native invocation in `permissionGrantParity_spec.js`.
- **scripter**: the 2nd argument to `engine_dispatch` in
  `arcanum/_lib/permission_grant.sh`; the key in `arcanum/_lib/migration-status.json`.

The old `permission-grant` key must not remain anywhere.

### 2. Registry entry shape and native method args

New entry:

```js
'permission-grant-add': { module: 'commands/PermissionGrant.js', method: 'add', context: 'claude' },
```

`context: 'claude'` ⇒ `Dispatcher` builds a `ClaudeContext` from `args[0]` (the
anchor) and strips it, so `commandArgs()` passes the **remaining** args straight
to the method. Therefore `PermissionGrant#add(file, pattern)` must receive
exactly `(file, pattern)` — **no leading `add` token**. `add` already has this
signature; it does not change.

### 3. Passthrough args from the shell shim (no `add` token)

`arcanum/_lib/permission_grant.sh` must invoke:

```sh
engine_dispatch "$anchor" permission-grant-add "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- "$anchor" "$@"
```

i.e. the post-`--` passthrough is `<anchor> <file> <pattern>` with the literal
`add` **removed**. `engine_dispatch` forwards the identical post-`--` list to
both the native bin and the shell fallback, so:

- **native**: `core/bin/arcanum permission-grant-add <anchor> <file> <pattern>` →
  Dispatcher strips `<anchor>` → `add(file, pattern)`.
- **shell fallback**: `bash permission_grant_shell.sh <anchor> <file> <pattern>` →
  `permission_grant_shell.sh`'s CLI dispatcher must accept this 3-arg shape
  (`<anchor>` consumed + ignored, then `permission_grant_add <file> <pattern>`),
  with its `case "${1:-}" in add)` gone.

`permissionGrantParity_spec.js` (node) invokes both sides with exactly these
shapes — shell: `bash SHELL_SCRIPT <cwd> <file> <pattern>`, native:
`arcanum permission-grant-add <cwd> <file> <pattern>`.

### 4. Human/agent CLI surface stays `permission_grant.sh <anchor> add <file> <pattern>`

`permission_grant.sh`'s own CLI dispatcher keeps its `case "${1:-}" in add) … *)`
guard — callers (`init-claude/setup_permissions.md`) still pass the `add` verb.
It is consumed by the `case` and simply not forwarded. Only scripter touches
this; listed here so node knows the outward CLI is unchanged.

### 5. The "unrecognized action" concept is removed entirely

- **node**: delete `run`, `USAGE_MESSAGE`, the `PermissionGrant_spec.js`
  "unrecognized or missing action" describe, and the
  `permissionGrantParity_spec.js` "an unrecognized action" describe.
- **scripter**: delete the `*)` usage-error branch from
  `permission_grant_shell.sh`'s CLI dispatcher.

There is no shared error contract left to keep in parity.

## CI Checks

- `core/`: `yarn test` (CI job: `test`) — covers `commands_spec.js`,
  `dispatcher_spec.js`, `PermissionGrant_spec.js`, and
  `permissionGrantParity_spec.js` (which shells out to the real
  `arcanum/_lib` scripts).
- `core/`: `yarn lint` (CI job: `checks`).
- No CI job gates `docs/agents/architecture/entrypoint-migration-status.md`
  freshness (unlike `tag-mutations.md`), and there is no `shellcheck` job — the
  shell changes are validated only via the parity spec and manual `bash -n`.

## Notes

- **#230 provenance flip is accepted.** After the `migration-status.json` key
  rename, `scripts/generate_entrypoint_migration_status.sh` resolves that row's
  Issue column from the first commit whose file snapshot contains the key — which
  becomes the #328 commit — so the column changes from `#230` to `#328`. No
  generator change; #230 history stays discoverable via git and the #236/#230
  issue chain.
- The sourced `permission_grant_add()` shell function in
  `permission_grant_shell.sh` is **out of scope** — it is called in-process by
  `arcanum/migrations/repos/*/*.sh` and must stay byte-for-byte as-is. Only the
  `if [[ "${BASH_SOURCE[0]}" == "$0" ]]` CLI-dispatcher block at the bottom of
  that file changes.
- `entrypoint-migration-status.md` is `AUTO-GENERATED, DO NOT EDIT BY HAND` —
  regenerate via the script, commit the diff, do not hand-edit.
- No behaviour change to `add` / dedupe / atomic-write / silent-degrade.
