# ESLint config with the boundary rule

Write `shared/eslint.config.mjs`, based on `core/eslint.config.mjs`:

- The base block (`js.configs.recommended`, `jsdoc.configs['flat/recommended']`, `files: ['**/*.js']`, ecmaVersion 2025, module, node globals) with core's style rules: `indent` 2, single `quotes`, `semi`, `no-var`, `prefer-const`, `eqeqeq` always, `no-console`, `jsdoc/require-jsdoc` (publicOnly; FunctionDeclaration, MethodDefinition, ClassDeclaration).
- The `spec/**/*.js` block: node + jasmine globals, `jsdoc/require-jsdoc` off.
- The boundary block on `files: ['lib/**/*.js']`: core's `lib/shared/**` rule, unchanged in substance — the `no-restricted-imports` allowlist regex `'^(?!(?:node:.+|\\.\\.?/(?:[\\w-][\\w.-]*/)*[\\w-][\\w.-]*)$)'` (lib files sit in `shared/lib/<area>/`, so one leading `../` stays inside `shared/lib/`), and `no-restricted-syntax` on `ImportExpression`. Reword the comments and message for `shared/lib/` (e.g. `Files under shared/lib/ may import only node: built-ins and other files under shared/lib/.`).
- Core's commands-layering block does not apply (`shared/` has no layers) and is not copied.

## Files to Change

- `shared/eslint.config.mjs` — new.
