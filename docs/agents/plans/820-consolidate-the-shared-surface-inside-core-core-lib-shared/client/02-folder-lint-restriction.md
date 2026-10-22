# Folder lint restriction

In `cli/eslint.config.mjs`, replace the 7-entry-file regex with a folder rule: any specifier containing `core/lib/` is restricted unless what follows is `shared/` (e.g. `(?:^|/)core/lib/(?!shared/)`), and any other `core/` path stays rejected. Update the message ("cli/ may import core/ only through core/lib/shared/") and the block comment.

Update `cli/spec/packaging/eslintBoundary_spec.js`:
- rejected: `core/lib/context/RepoContext.js`, `core/lib/utils/config/BooleanKeyConfig.js`, and an old surface path such as `core/lib/utils/config/ConfigChain.js`;
- accepted: surface files under `core/lib/shared/{config,file}/`, including a non-entry one (e.g. `shared/config/RepoConfig.js`), which is now allowed.

## Files to Change
- `cli/eslint.config.mjs` — folder-based `core/lib` restriction
- `cli/spec/packaging/eslintBoundary_spec.js` — new cases
