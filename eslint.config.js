// @ts-check
// Prefer <Button> and <IconButton> from src/common/components over raw <button> elements.
// Raw <button> usage is only permitted inside plugin-injected UI (mark with // [plugin-button-exception]).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/', 'node_modules/', 'sample-project/', 'public/sdk/'],
  },

  // Global: ESLint recommended + Prettier (applies to all .js/.ts/.tsx files)
  eslint.configs.recommended,
  prettierRecommended,

  // Global custom rules
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // TypeScript-specific: strict type-checked rules, scoped to .ts/.tsx only
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  // TypeScript-specific: parser options and TS-only rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // JavaScript-specific rules (mirrors TS rules where applicable)
  {
    files: ['**/*.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
);
