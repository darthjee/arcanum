# node Plan: Split permission-grant's run(action, …) into a permission-grant-add registry entry

Main plan: [plan.md](plan.md)

## Shared contracts

- Command name becomes `permission-grant-add` everywhere in `core/` (registry key,
  spec command strings, native invocation in the parity spec). No `permission-grant`
  key left.
- New registry entry:
  `'permission-grant-add': { module: 'commands/PermissionGrant.js', method: 'add', context: 'claude' }`.
- `context: 'claude'` ⇒ `Dispatcher` strips `args[0]` (anchor); the method
  receives the remaining args. `PermissionGrant#add(file, pattern)` must get
  exactly `(file, pattern)` — **no leading `add` token**.
- The shell shim (scripter's work) stops forwarding the literal `add`, so the
  parity spec must invoke both sides as `<anchor> <file> <pattern>` (native:
  `arcanum permission-grant-add <cwd> <file> <pattern>`; shell:
  `bash SHELL_SCRIPT <cwd> <file> <pattern>`).
- The "unrecognized / missing action" concept is removed entirely — delete `run`,
  `USAGE_MESSAGE`, and both specs' unrecognized-action describes. No error-parity
  contract remains.

## Steps

- [01 — Rename the registry entry to permission-grant-add](node/01-rename-registry-entry.md)
- [02 — Drop run and USAGE_MESSAGE from PermissionGrant](node/02-drop-run-from-permissiongrant.md)
- [03 — Rework PermissionGrant_spec.js onto #add](node/03-rework-permissiongrant-spec.md)
- [04 — Update dispatcher_spec.js context: 'claude' cases](node/04-update-dispatcher-spec.md)
- [05 — Update commands_spec.js assertion](node/05-update-commands-spec.md)
- [06 — Update permissionGrantParity_spec.js](node/06-update-parity-spec.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- `core/bin/arcanum` routes generically off `COMMANDS` — no hardcoded
  `permission-grant` string there; confirm with a grep but expect no change.
- `permissionGrantParity_spec.js` shells out to the real `arcanum/_lib` scripts,
  so it only goes green once scripter's changes are also on the branch. Run the
  full `yarn test` after both agents' work is integrated.
- Keep the JSDoc/comment edits tight — update names and the stripped-token
  description, don't rewrite the prose.
