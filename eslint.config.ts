import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([ 'dist' ]),
  {
    files: [ '**/*.{ts,tsx}' ],
    plugins: {
      '@stylistic': stylistic,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      stylistic.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@stylistic/indent': [
        'error',
        2,
        {
          offsetTernaryExpressions: false,
          SwitchCase: 1,
        },
      ],
      '@stylistic/semi': [ 'error', 'always' ],
      '@stylistic/arrow-parens': [ 'error', 'as-needed', { requireForBlockBody: true } ],
      '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'semi',
            requireLast: true,
          },
          singleline: {
            delimiter: 'semi',
            requireLast: true,
          },
          multilineDetection: 'brackets',
        },
      ],
      '@stylistic/operator-linebreak': [
        'error',
        'before',
        {
          overrides: {
            '=': 'after',
          },
        },
      ],
      '@stylistic/jsx-one-expression-per-line': [ 'error', { allow: 'single-line' } ],
      '@stylistic/jsx-closing-tag-location': [ 'error', 'line-aligned' ],
      '@stylistic/jsx-closing-bracket-location': [ 'error', 'after-props' ],
      '@stylistic/jsx-quotes': [ 'error', 'prefer-single' ],
      '@stylistic/jsx-indent-props': [ 'error', 2 ],
      '@stylistic/jsx-wrap-multilines': [
        'error',
        {
          declaration: 'parens',
          assignment: 'parens',
          return: 'parens',
          arrow: 'parens',
          condition: 'ignore',
          logical: 'ignore',
          prop: 'ignore',
          propertyValue: 'ignore',
        },
      ],
    },
  },
]);
