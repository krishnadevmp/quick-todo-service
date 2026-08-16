import { describe, expect, it, vi } from 'vitest';
import { prismaMock } from '../../mocks/prisma';

vi.mock('../../../src/lib/prisma', () => ({ prisma: prismaMock }));

import * as settingsService from '../../../src/services/settings.service';

const DEFAULTS = {
  userId: 'user-1',
  theme: 'dark',
  notificationsEnabled: false,
  defaultReminderOffset: '30',
  defaultPriority: 'none',
  showCompleted: true,
  currency: 'AED',
  updatedAt: new Date(),
};

describe('settingsService.getSettings', () => {
  it('returns the settings row without leaking userId', async () => {
    prismaMock.userSettings.upsert.mockResolvedValue(DEFAULTS);

    const result = await settingsService.getSettings('user-1');

    expect(result).toEqual({
      theme: 'dark',
      notificationsEnabled: false,
      defaultReminderOffset: '30',
      defaultPriority: 'none',
      showCompleted: true,
      currency: 'AED',
    });
  });

  it('self-heals via upsert if a user somehow has no settings row yet', async () => {
    prismaMock.userSettings.upsert.mockResolvedValue(DEFAULTS);
    await settingsService.getSettings('user-1');

    const args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 'user-1' });
    expect(args.create).toEqual({ userId: 'user-1' }); // relies on the Prisma schema's own defaults
  });
});

describe('settingsService.updateSettings', () => {
  it('patches only the given fields', async () => {
    prismaMock.userSettings.upsert.mockResolvedValue({ ...DEFAULTS, theme: 'light', currency: 'USD' });

    const result = await settingsService.updateSettings('user-1', { theme: 'light', currency: 'USD' });

    expect(result.theme).toBe('light');
    expect(result.currency).toBe('USD');

    const args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ theme: 'light', currency: 'USD' });
    expect(args.create).toEqual({ userId: 'user-1', theme: 'light', currency: 'USD' });
  });
});
