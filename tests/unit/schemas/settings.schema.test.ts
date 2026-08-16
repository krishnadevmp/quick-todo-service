import { describe, expect, it } from 'vitest';
import { settingsUpdateSchema } from '../../../src/schemas/settings.schema';

describe('settingsUpdateSchema', () => {
  it('accepts an empty patch', () => {
    expect(settingsUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a full valid patch', () => {
    const result = settingsUpdateSchema.safeParse({
      theme: 'light',
      notificationsEnabled: true,
      defaultReminderOffset: '60',
      defaultPriority: 'high',
      showCompleted: false,
      currency: 'USD',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown theme', () => {
    expect(settingsUpdateSchema.safeParse({ theme: 'solarized' }).success).toBe(false);
  });

  it('rejects an unknown currency code', () => {
    expect(settingsUpdateSchema.safeParse({ currency: 'JPY' }).success).toBe(false);
  });

  it('rejects a non-boolean for notificationsEnabled', () => {
    expect(settingsUpdateSchema.safeParse({ notificationsEnabled: 'true' }).success).toBe(false);
  });
});
