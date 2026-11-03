import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '~~': fileURLToPath(new URL('.', import.meta.url)) } },
        test: {
          name: 'unit',
          globals: true,
          globalSetup: ['tests/support/prepare-test-database-template.ts'],
          environment: 'node',
          testTimeout: 30000,
          include: [
            'tests/unit/**/*.test.ts',
            'tests/price-sources/**/*.test.ts',
            'tests/identification-sources/**/*.test.ts',
            'tests/source-http/**/*.test.ts',
            'tests/probe/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'slow',
          globals: true,
          environment: 'node',
          include: ['tests/slow/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 600000,
          hookTimeout: 600000,
        },
      },
      {
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['tests/e2e/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 120000,
          hookTimeout: 300000,
        },
      },
    ],
  },
})
