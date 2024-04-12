import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 300000, // For longer running integration tests
  },
});
