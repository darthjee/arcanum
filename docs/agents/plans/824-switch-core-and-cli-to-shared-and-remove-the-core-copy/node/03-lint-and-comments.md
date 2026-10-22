# Lint rules and comments

- `core/eslint.config.mjs`:
  - Remove the `files: ['lib/shared/**/*.js']` block. `shared/eslint.config.mjs` now enforces the surface's own boundary.
  - Add a `no-restricted-imports` pattern for `lib/**`, `bin/**` and `spec/**` that rejects any specifier matching `(?:^|/)shared/spec/`, with a message pointing at `docs/agents/specs/shared-lib.md`. Merge it with the existing layering patterns: in a flat config, the last matching block wins for a rule, so add the pattern to every block that already sets `no-restricted-imports` for those files.
- Repoint the comments and docblocks that name `core/lib/shared/...` to `shared/lib/...`:
  - `core/lib/utils/config/NamespacedBooleanKeyConfig.js`;
  - `core/lib/commands/shared/PermissionGrant.js`;
  - `core/lib/commands/auto-fix-all/AutoFixAllQueue.js`;
  - `core/spec/support/strictConfigKeys.js`;
  - `core/spec/support/fixtures/agentEmailFixtures.js`, whose reference to `core/spec/lib/shared/config/AgentEmail_spec.js` becomes `shared/spec/config/AgentEmail_spec.js`;
  - `core/spec/bin/agentEmailParity_spec.js`;
  - `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js` (`core/lib/shared/config/keys.json` becomes `shared/lib/config/keys.json`).
- Final check: `grep -rn "core/lib/shared\|lib/shared/" core --exclude-dir=node_modules` must print only `core/lib/commands/shared/` and `core/spec/lib/commands/shared/` paths, if anything.

## Files to Change

- `core/eslint.config.mjs`: drop the surface-folder rule and add the `shared/spec/` ban.
- `core/lib/utils/config/NamespacedBooleanKeyConfig.js`, `core/lib/commands/shared/PermissionGrant.js` and `core/lib/commands/auto-fix-all/AutoFixAllQueue.js`: comment paths.
- `core/spec/support/strictConfigKeys.js`, `core/spec/support/fixtures/agentEmailFixtures.js`, `core/spec/bin/agentEmailParity_spec.js` and `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js`: comment paths.
