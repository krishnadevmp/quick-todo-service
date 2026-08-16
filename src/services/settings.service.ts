import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { settingsUpdateSchema } from '../schemas/settings.schema';

type SettingsPatch = z.infer<typeof settingsUpdateSchema>;

function toDto(settings: {
  theme: string;
  notificationsEnabled: boolean;
  defaultReminderOffset: string;
  defaultPriority: string;
  showCompleted: boolean;
  currency: string;
}) {
  return {
    theme: settings.theme,
    notificationsEnabled: settings.notificationsEnabled,
    defaultReminderOffset: settings.defaultReminderOffset,
    defaultPriority: settings.defaultPriority,
    showCompleted: settings.showCompleted,
    currency: settings.currency,
  };
}

export async function getSettings(userId: string) {
  // Defensive upsert: every signup creates settings, but this keeps GET
  // safe even against rows created before this table existed.
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return toDto(settings);
}

export async function updateSettings(userId: string, patch: SettingsPatch) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...patch },
  });
  return toDto(settings);
}
