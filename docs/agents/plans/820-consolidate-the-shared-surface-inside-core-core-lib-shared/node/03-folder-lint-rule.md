# Folder lint rule

In `core/eslint.config.mjs`, replace the shared-surface block's 9-file `files` list with `files: ['lib/shared/**/*.js']`, and replace its specifier allowlist with a rule that admits only `node:` specifiers and relative specifiers resolving inside `lib/shared/` (e.g. `./X.js`, `./keys.json`, `../config/X.js`, `../file/X.js`; anything reaching `../../` is rejected). Keep the `no-restricted-syntax` ban on `ImportExpression`. Rewrite the block comment: the folder is now the declaration of the surface; drop "this `files` list is the authoritative declaration".

The layering block (`lib/context/**`, `lib/services/**`, `lib/utils/**`) does not need `lib/shared/**`: the folder allowlist already rejects `commands/`. Keep the shared block **after** the layering block (flat config: last match wins).

Verify with `yarn lint` that a stray import (e.g. `../../context/RepoContext.js` from a shared file) fails.

## Files to Change
- `core/eslint.config.mjs` — folder-based shared-surface block
