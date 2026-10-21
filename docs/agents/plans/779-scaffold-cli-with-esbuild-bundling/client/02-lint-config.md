# Lint config

Create `cli/eslint.config.mjs` with the same style rules as `core/eslint.config.mjs` (2-space indent, single quotes, semicolons, `const`/`let` only, strict `===`, no `console.log`, JSDoc on public functions), plus:

- A block for `bin/arcanum` with a conservative `ecmaVersion` (2020), so the gate cannot use syntax a too-old Node would choke on before it prints its message.
- The CLI-side shared-surface rule from [Shared Config Logic → Shared-surface lint rule](../../../specs/arcanum-cli/shared-config-logic.md#shared-surface-lint-rule): `no-restricted-imports` restricting any `**/core/lib/**` specifier to the surface entry files the CLI uses (`ConfigChain`, `RepoConfigWriter`, `ConfigError`, `AgentEmail`, `KeyRegistry`, `Lock`, `RepoPath`).
- Ignore `dist/`, `coverage/` and `node_modules/`.

## Files to Change

- `cli/eslint.config.mjs` — new lint config.
