import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

// Same style rules as core/eslint.config.mjs, plus the CLI-only blocks
// below (see docs/agents/specs/arcanum-cli/shared-config-logic.md).

const styleRules = {
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
};

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**']
  },
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.mjs', 'bin/arcanum'],
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
    rules: styleRules
  },
  {
    // The Node-floor gate runs before the version check has passed, so it
    // must parse on a Node older than the floor. Keep its syntax to
    // ES2020 (dynamic import() is the newest feature it needs).
    files: ['bin/arcanum'],
    languageOptions: {
      ecmaVersion: 2020
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
    // CLI side of the shared-surface guardrail: anything under core/lib
    // may be imported only through the surface entry files the CLI uses.
    // Without this, esbuild would silently bundle any other core/lib file.
    // The build's metafile check covers resolved paths on top of this.
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(?:^|/)core/lib/(?!utils/config/(?:ConfigChain|RepoConfigWriter|ConfigError|AgentEmail|KeyRegistry)\\.js$' +
                '|utils/file/(?:Lock|RepoPath)\\.js$)',
              message:
                'cli/ may import core/lib only through the shared-surface entry files (ConfigChain, ' +
                'RepoConfigWriter, ConfigError, AgentEmail, KeyRegistry, Lock, RepoPath) — see ' +
                'docs/agents/specs/arcanum-cli/shared-config-logic.md.'
            }
          ]
        }
      ]
    }
  }
];
