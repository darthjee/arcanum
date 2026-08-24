# node Plan: Reorganize core/lib/ into subfolders

Main plan: [plan.md](plan.md)

## Steps

- [01 — Move utils/ files into domain subfolders](node/01-move-utils-files.md)
- [02 — Move commands/ files into commands/](node/02-move-commands-files.md)
- [03 — Delete dead Greeter.js](node/03-delete-greeter.md)
- [04 — Update core/bin/arcanum's registry and direct imports](node/04-update-bin-arcanum.md)
- [05 — Mirror the structure in core/spec/lib/](node/05-mirror-spec-structure.md)
- [06 — Cleanup stale references and verify](node/06-cleanup-verify.md)

## CI Checks

- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn test` (CI job: `test`)

## Notes

- This is a pure file-move + import-path-update issue — no logic changes, except deleting `Greeter.js`/`Greeter_spec.js` (confirmed dead code) and adding `DispatchFailure_spec.js` (closes a pre-existing spec-mirror gap). See step 03 and step 05.
- The split rule (settled during issue discussion): `commands/` holds every module dispatched directly through `core/bin/arcanum`'s `COMMANDS` registry, regardless of domain; `utils/` holds everything else, grouped by domain, with empty domain subfolders dropped (`utils/permissions/` no longer exists — its only file, `PermissionGrant.js`, is dispatch-table-registered and moves to `commands/`).
- Do the utils/ move (step 01) before the commands/ move (step 02) so that by the time commands/ files are relocated and their imports rewritten, every utils/ target path already exists and is final — avoids touching the same import path twice.
- No `require()`/import path outside `core/` (skills scripts, Makefile, docs) needs a functional change — confirmed nothing shells out to `node core/lib/X.js` directly. Prose mentions of `core/lib/` in `AGENTS.md`, `docs/agents/architecture/script-engine.md`, etc. describe the folder as a concept and don't need updating.
