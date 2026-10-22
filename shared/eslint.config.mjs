import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['**/*.js'],
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
    // The import boundary (see docs/agents/specs/shared-lib.md): everything
    // under `shared/lib/` is public, so the folder itself is the declaration
    // of the surface. Its files may import only `node:` built-ins and
    // relative paths that stay inside `shared/lib/`, with no dynamic
    // `import()`.
    files: ['lib/**/*.js'],
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
              // (lib files sit in `shared/lib/<area>/`, so one `../`
              // stays inside `shared/lib/`); no later segment may start
              // with a dot, which rejects any further `..` (e.g.
              // `../../../core/lib/context/RepoContext.js`).
              regex:
                '^(?!(?:node:.+' +
                '|\\.\\.?/(?:[\\w-][\\w.-]*/)*[\\w-][\\w.-]*)$)',
              message: 'Files under shared/lib/ may import only node: built-ins and other files under shared/lib/.'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'No dynamic import() under shared/lib/.' }
      ]
    }
  }
];
