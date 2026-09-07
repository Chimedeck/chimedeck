// @ts-check
// Prefer <Button> and <IconButton> from src/common/components over raw <button> elements.
// Raw <button> usage is only permitted inside plugin-injected UI (mark with // [plugin-button-exception]).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const typeCheckedFiles = [
  'src/**/*.{ts,tsx}',
  'server/**/*.ts',
  'vite.config.ts',
  'tailwind.config.ts',
];

const strictTypeCheckedFiles = tseslint.configs.strictTypeChecked.map((config) => ({
  ...config,
  files: typeCheckedFiles,
}));

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...strictTypeCheckedFiles,
  {
    files: typeCheckedFiles,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'sample-project/'],
  }
);
