import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000, // For longer running integration tests
  },
});
