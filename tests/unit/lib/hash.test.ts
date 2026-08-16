import { describe, expect, it } from 'vitest';
import { hashPassword, normalizeEmail, verifyPassword } from '../../../src/lib/hash';

describe('hashPassword / verifyPassword', () => {
  it('a hashed password verifies against the original plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('never stores the plaintext in the hash', async () => {
    const plain = 'correct horse battery staple';
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
  });

  it('salts each hash independently — same input, different output', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
  });
});

describe('normalizeEmail', () => {
  it('lowercases the address', () => {
    expect(normalizeEmail('Foo@Example.com')).toBe('foo@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmail('  foo@example.com  ')).toBe('foo@example.com');
  });
});
