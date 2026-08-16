import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Hermetic test env — independent of any local .env file, so tests
    // pass the same way on a fresh clone or in CI. Prisma itself is always
    // mocked (tests/mocks/prisma.ts), so DATABASE_URL never needs to point
    // at a real database — it just has to satisfy src/lib/env.ts's schema.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-do-not-use-in-prod',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173',
      PORT: '4000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Out of unit-test scope by design: thin HTTP glue (routes/controllers,
      // app.ts's middleware wiring, the auth/errorHandler/validate middleware)
      // and the Prisma singleton itself. These need a real request/response
      // cycle (or a real DB) to test meaningfully — that's an integration-test
      // pass, not unit tests. See README.md "Status / not yet done".
      exclude: [
        'src/server.ts',
        'src/app.ts',
        'src/types/**',
        'src/routes/**',
        'src/controllers/**',
        'src/middleware/**',
        'src/lib/prisma.ts',
      ],
    },
  },
});
