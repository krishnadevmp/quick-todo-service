import { prisma } from '../lib/prisma';
import { hashPassword, normalizeEmail, verifyPassword } from '../lib/hash';
import { signAccessToken } from '../lib/jwt';
import { badRequest, conflict, unauthorized } from '../utils/httpError';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function toPublicUser(user: { id: string; name: string; email: string; createdAt: Date }): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() };
}

export async function signup(name: string, email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      settings: { create: {} }, // picks up UserSettings' schema defaults == frontend's DEFAULT_SETTINGS
    },
  });

  const token = signAccessToken(user.id);
  return { user: toPublicUser(user), token };
}

export async function login(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw unauthorized('Invalid email or password');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw unauthorized('Invalid email or password');

  const token = signAccessToken(user.id);
  return { user: toPublicUser(user), token };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('User no longer exists');
  return toPublicUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('User no longer exists');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw badRequest('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
