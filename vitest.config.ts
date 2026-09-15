import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/main/services/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'tests/unit/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/main/services/**', 'src/shared/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
})
