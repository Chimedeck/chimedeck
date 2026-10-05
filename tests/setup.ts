import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();

  if (document && document.body) {
    document.body.innerHTML = '';
  }
});
