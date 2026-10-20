# Shared-surface allowlist

Add `core/lib/utils/config/KeyRegistry.js` (and `keys.json` if the lint block lists non-JS files) to the explicit shared-surface `files` list in `core/eslint.config.mjs` introduced by #778, per [Location](../../../specs/arcanum-cli/key-registry.md#location). Make sure `KeyRegistry.js` passes that block's restricted-imports rules.

If #778 has not merged, so the block doesn't exist, report this step as blocked on #778 instead of creating the block.

## Files to Change
- `core/eslint.config.mjs` — add the registry files to the shared-surface list.
