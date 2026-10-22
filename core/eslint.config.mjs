import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['**/*.js', 'bin/arcanum'],
    plugins: {
      jsdoc
    },
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true
          }
        }
      ]
    }
  },
  {
    files: ['spec/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jasmine
      }
    },
    rules: {
      'jsdoc/require-jsdoc': 'off'
    }
  },
  {
    // Enforces `lib/`'s one-way `commands` → `context`/`services` →
    // `utils` layering (see docs/agents/architecture/script-engine.md):
    // nothing under `context/`, `services/`, or `utils/` may import from
    // `commands/` — a command is an entrypoint, not a library other
    // layers should reach back into.
    files: ['lib/context/**/*.js', 'lib/services/**/*.js', 'lib/utils/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/commands/**'],
              message:
                'context/, services/, and utils/ may not import from commands/ — see the one-way ' +
                'commands → context/services → utils layering documented in ' +
                'docs/agents/architecture/script-engine.md.'
            }
          ]
        }
      ]
    }
  },
  {
    // The shared surface (see docs/agents/specs/shared-lib.md): everything
    // under `lib/shared/` is bundled into arcanum-cli, so the folder itself
    // is the declaration of the surface. Its files may import only `node:`
    // built-ins and relative paths that stay inside `lib/shared/`.
    // Replaces the commands-layering rule above for these files (flat
    // config: last matching block wins); the allowlist already rejects
    // commands/.
    files: ['lib/shared/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // An allowlist: any specifier NOT matching one of these
              // alternatives is restricted. (A gitignore-style `group`
              // with `**` plus `!` re-includes cannot express this: `**`
              // also excludes the parent `.`/`..`/`node:fs` segments,
              // which gitignore semantics never re-include.)
              // Relative specifiers may start with `./` or a single `../`
              // (surface files sit in `lib/shared/<area>/`, so one `../`
              // stays inside `lib/shared/`); no later segment may start
              // with a dot, which rejects any further `..` (e.g.
              // `../../context/RepoContext.js`).
              regex:
                '^(?!(?:node:.+' +
                '|\\.\\.?/(?:[\\w-][\\w.-]*/)*[\\w-][\\w.-]*)$)',
              message: 'Files under lib/shared/ may import only node: built-ins and other files under lib/shared/.'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'No dynamic import() on the shared surface.' }
      ]
    }
  }
];
