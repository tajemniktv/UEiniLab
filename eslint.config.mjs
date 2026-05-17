import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules
    }
  },
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly'
      }
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        suite: 'readonly',
        test: 'readonly',
        setTimeout: 'readonly'
      }
    }
  }
];
