import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema, signupSchema } from '../../../src/schemas/auth.schema';

describe('signupSchema', () => {
  it('accepts a valid signup payload', () => {
    const result = signupSchema.safeParse({ name: 'Krishna', email: 'krishna@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('trims the name and rejects a blank one', () => {
    expect(signupSchema.safeParse({ name: '   ', email: 'a@b.com', password: 'password123' }).success).toBe(false);
    const parsed = signupSchema.parse({ name: '  Krishna  ', email: 'a@b.com', password: 'password123' });
    expect(parsed.name).toBe('Krishna');
  });

  it('rejects an invalid email', () => {
    expect(signupSchema.safeParse({ name: 'K', email: 'not-an-email', password: 'password123' }).success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(signupSchema.safeParse({ name: 'K', email: 'a@b.com', password: 'short1' }).success).toBe(false);
  });

  it('accepts exactly the 8-character minimum', () => {
    expect(signupSchema.safeParse({ name: 'K', email: 'a@b.com', password: '12345678' }).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password (length rules are a signup-time concern only)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('rejects a new password shorter than 8 characters', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success).toBe(false);
  });
});
