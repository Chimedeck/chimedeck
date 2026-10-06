// Type-only module: pulls @testing-library/jest-dom's Vitest matcher augmentations
// (toHaveAttribute, toBeTruthy, ...) into the root TypeScript program.
//
// [why this file exists] tests/setup.ts — where jest-dom is imported at runtime —
// sits outside tsconfig.json's include set, so the matcher typings were invisible
// to `tsc --noEmit` and every toHaveAttribute call in vitest-collected test files
// errored TS2339. Importing the augmentation here makes those types program-global.
import '@testing-library/jest-dom/vitest';
