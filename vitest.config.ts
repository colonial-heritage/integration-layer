import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 180000, // For longer running integration tests
  },
});
