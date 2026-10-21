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
    // The CLI's declared shared surface (see
    // docs/agents/specs/arcanum-cli/shared-config-logic.md): these files
    // are bundled into arcanum-cli, so they may import only `node:`
    // built-ins and each other (KeyRegistry.js also loads `./keys.json`).
    // This `files` list is the authoritative declaration of the surface.
    // Replaces the commands-layering rule above for these files (flat
    // config: last matching block wins); the allowlist already rejects
    // commands/.
    files: [
      'lib/utils/config/ConfigChain.js',
      'lib/utils/config/RepoConfig.js',
      'lib/utils/config/RepoConfigWriter.js',
      'lib/utils/config/ConfigError.js',
      'lib/utils/config/AgentEmail.js',
      'lib/utils/config/KeyRegistry.js',
      'lib/utils/file/Lock.js',
      'lib/utils/file/LockTimeoutError.js',
      'lib/utils/file/RepoPath.js'
    ],
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
              regex:
                '^(?!(?:node:.+' +
                '|\\./(?:ConfigChain|RepoConfig|RepoConfigWriter|ConfigError|AgentEmail|KeyRegistry)\\.js' +
                '|\\./keys\\.json' +
                '|\\./(?:Lock|LockTimeoutError|RepoPath)\\.js' +
                '|\\.\\./file/(?:Lock|LockTimeoutError|RepoPath)\\.js' +
                '|\\.\\./config/(?:ConfigChain|ConfigError)\\.js)$)',
              message: 'Shared-surface files may import only node: built-ins and other shared-surface files.'
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
