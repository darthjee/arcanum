# Delete the core copy and its specs

- Delete `core/lib/shared/` (`config/` and `file/`). Add no re-export shims.
- Delete `core/spec/lib/shared/`. Each of its specs already has a counterpart in `shared/spec/`: `config/*_spec.js` and `file/*_spec.js`.
- If a spec-support file under `core/spec/support/` was used only by the deleted specs, keep it if another core spec still uses it. `strictConfigKeys.js` and `fixtures/agentEmailFixtures.js` are still used by core specs and the parity spec.
- Run `make core-check` and confirm everything is green.

## Files to Change

- `core/lib/shared/**`: deleted.
- `core/spec/lib/shared/**`: deleted.
