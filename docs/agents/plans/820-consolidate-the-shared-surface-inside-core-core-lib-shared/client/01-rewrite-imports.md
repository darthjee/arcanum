# Rewrite cli imports

Point every `cli/` import of the surface at `core/lib/shared/...` (e.g. `../../../core/lib/utils/config/ConfigChain.js` → `../../../core/lib/shared/config/ConfigChain.js`). No shims.

## Files to Change
- `cli/lib/commands/config.js` — import paths
- `cli/spec/lib/commands/config_spec.js` — import paths
