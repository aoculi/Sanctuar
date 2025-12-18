import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: ':memory:',
      JWT_SECRET: 'test-secret-key-for-testing-only-not-for-production',
      PORT: '3200',
    },
  },
})
