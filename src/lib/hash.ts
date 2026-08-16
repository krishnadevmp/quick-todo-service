import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Emails are matched case-insensitively without a DB extension — normalize on the way in. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
