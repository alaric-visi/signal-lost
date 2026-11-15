import { defineConfig } from 'vitest/config';

/* Relative base so the built game runs from any path or a plain file host. */
export default defineConfig({
  base: './',
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
});
