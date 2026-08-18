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
      ecmaVersion: 2023,
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
  }
];
