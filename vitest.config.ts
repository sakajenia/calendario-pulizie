import { defineConfig } from 'vitest/config'
import path from 'node:path'

/*
 * Test unitari dei moduli puri (src/lib). Config separata da vite.config.ts:
 * qui non servono il plugin React ne' la targa della build, solo l'alias "@/".
 * I test end-to-end (tests/e2e/*.spec.mjs) girano con scripts/e2e.mjs, non qui.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
})
