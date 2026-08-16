import { z } from 'zod';
import { currencyCodeSchema, prioritySchema, reminderOffsetSchema, themeSchema } from './common.schema';

export const settingsUpdateSchema = z.object({
  theme: themeSchema.optional(),
  notificationsEnabled: z.boolean().optional(),
  defaultReminderOffset: reminderOffsetSchema.optional(),
  defaultPriority: prioritySchema.optional(),
  showCompleted: z.boolean().optional(),
  currency: currencyCodeSchema.optional(),
});
