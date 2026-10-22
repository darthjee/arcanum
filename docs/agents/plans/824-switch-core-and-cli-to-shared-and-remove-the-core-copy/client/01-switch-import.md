# Switch the cli import

`cli/lib/commands/config.js` changes `import KeyRegistry from '../../../core/lib/shared/config/KeyRegistry.js';` to `import KeyRegistry from '../../../shared/lib/config/KeyRegistry.js';`. Check that no other `cli/lib` or `cli/spec` file imports `core/` (`grep -rn "core/" cli/lib cli/spec cli/scripts`). Fix any you find the same way, except for the boundary specs covered in step 02.

## Files to Change

- `cli/lib/commands/config.js`: import from `shared/lib/`.
