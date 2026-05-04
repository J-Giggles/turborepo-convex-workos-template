import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import turbo from 'eslint-plugin-turbo';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { turbo },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
  {
    ignores: ['dist/**', '.next/**', '_generated/**', 'node_modules/**'],
  },
];
