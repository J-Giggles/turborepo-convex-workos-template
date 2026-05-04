import nextPlugin from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import baseConfig from './base.js';

export default [
  ...baseConfig,
  react.configs.flat.recommended,
  reactHooks.configs['recommended-latest'],
  {
    plugins: { '@next/next': nextPlugin },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
];
