import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Clean up after each test
afterEach(() => {
  if (document && document.body) {
    document.body.innerHTML = '';
  }
});

