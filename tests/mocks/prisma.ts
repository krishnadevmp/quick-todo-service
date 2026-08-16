import { vi } from 'vitest';

/**
 * A hand-rolled mock of the Prisma Client, covering only the methods the
 * services actually call. Services import the real `prisma` singleton from
 * src/lib/prisma.ts; each test file redirects that import to this object
 * with `vi.mock('../../../src/lib/prisma', () => ({ prisma: prismaMock }))`
 * so no test ever touches a real database.
 */
function makeModelMock() {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  };
}

export const prismaMock = {
  user: makeModelMock(),
  userSettings: makeModelMock(),
  tag: makeModelMock(),
  task: makeModelMock(),
  taskTag: makeModelMock(),
  expense: makeModelMock(),
  // Services call this two ways: prisma.$transaction(async (tx) => ...) and
  // (unused here) prisma.$transaction([...]) — support both, and hand the
  // callback form the same mock object as `tx` since it's already a stub.
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};
