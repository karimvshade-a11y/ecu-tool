import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Look for test files inside a 'tests' folder
    include: ['tests/**/*.test.ts'],
    // Use a separate TS config that includes both src and tests,
    // so your production tsconfig stays clean.
    tsconfig: 'tsconfig.test.json',
  },
});