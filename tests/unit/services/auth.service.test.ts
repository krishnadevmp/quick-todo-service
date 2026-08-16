import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '../../mocks/prisma';

vi.mock('../../../src/lib/prisma', () => ({ prisma: prismaMock }));

import * as authService from '../../../src/services/auth.service';
import { verifyAccessToken } from '../../../src/lib/jwt';
import { hashPassword } from '../../../src/lib/hash';

const NOW = new Date('2026-08-16T10:00:00.000Z');

function fakeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    name: 'Krishna',
    email: 'krishna@example.com',
    passwordHash: 'irrelevant-in-most-tests',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('authService.signup', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockImplementation(async ({ data }: any) => fakeUser({ email: data.email, name: data.name }));
  });

  it('creates the user with default settings and returns a valid token', async () => {
    const { user, token } = await authService.signup('Krishna', 'Krishna@Example.com', 'password123');

    expect(user).toEqual({ id: 'user-1', name: 'Krishna', email: 'krishna@example.com', createdAt: NOW.toISOString() });
    expect(verifyAccessToken(token).sub).toBe('user-1');

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.settings).toEqual({ create: {} });
  });

  it('normalizes the email to lowercase before checking for + storing it', async () => {
    await authService.signup('Krishna', 'Krishna@Example.com', 'password123');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'krishna@example.com' } });
    expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe('krishna@example.com');
  });

  it('never returns the password hash', async () => {
    const { user } = await authService.signup('Krishna', 'krishna@example.com', 'password123');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('password');
  });

  it('rejects signup when the email is already taken', async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser());
    await expect(authService.signup('Krishna', 'krishna@example.com', 'password123')).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe('authService.login', () => {
  it('succeeds with the correct password and returns a valid token', async () => {
    const passwordHash = await hashPassword('password123');
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ passwordHash }));

    const { user, token } = await authService.login('krishna@example.com', 'password123');

    expect(user.id).toBe('user-1');
    expect(verifyAccessToken(token).sub).toBe('user-1');
  });

  it('rejects an unknown email without revealing whether the account exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(authService.login('nobody@example.com', 'password123')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects an incorrect password with the same error as an unknown email', async () => {
    const passwordHash = await hashPassword('password123');
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ passwordHash }));

    await expect(authService.login('krishna@example.com', 'wrong-password')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });
});

describe('authService.getCurrentUser', () => {
  it('returns the public profile for a valid user id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser());
    const user = await authService.getCurrentUser('user-1');
    expect(user).toEqual({ id: 'user-1', name: 'Krishna', email: 'krishna@example.com', createdAt: NOW.toISOString() });
  });

  it('rejects when the user no longer exists (e.g. deleted account, stale token)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(authService.getCurrentUser('ghost-id')).rejects.toMatchObject({ status: 401 });
  });
});

describe('authService.changePassword', () => {
  it('updates the hash when the current password is correct', async () => {
    const passwordHash = await hashPassword('old-password');
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ passwordHash }));
    prismaMock.user.update.mockResolvedValue(fakeUser());

    await authService.changePassword('user-1', 'old-password', 'new-password');

    const updateArgs = prismaMock.user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(updateArgs.data.passwordHash).not.toBe(passwordHash);
  });

  it('rejects with 400 when the current password is wrong, without touching the DB', async () => {
    const passwordHash = await hashPassword('old-password');
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ passwordHash }));

    await expect(authService.changePassword('user-1', 'not-the-old-password', 'new-password')).rejects.toMatchObject({
      status: 400,
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(authService.changePassword('ghost-id', 'x', 'y')).rejects.toMatchObject({ status: 401 });
  });
});
