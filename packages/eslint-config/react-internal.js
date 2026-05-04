import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import baseConfig from './base.js';

export default [
  ...baseConfig,
  react.configs.flat.recommended,
  reactHooks.configs['recommended-latest'],
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
];
