import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../../src/lib/jwt';

describe('signAccessToken / verifyAccessToken', () => {
  it('a signed token verifies back to the same user id', () => {
    const token = signAccessToken('user-123');
    expect(verifyAccessToken(token).sub).toBe('user-123');
  });

  it('rejects a token signed with a different secret', () => {
    const foreignToken = jwt.sign({ sub: 'user-123' }, 'a-different-secret');
    expect(() => verifyAccessToken(foreignToken)).toThrow();
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'user-123' }, 'test-secret-do-not-use-in-prod', { expiresIn: -10 });
    expect(() => verifyAccessToken(expired)).toThrow();
  });
});
